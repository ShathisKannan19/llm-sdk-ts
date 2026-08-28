import { ZodError } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { spawn } from "node:child_process";

import { RequestValidationError } from "../errors/llm-error.js";
import { speechSynthesizeRequestSchema } from "../schemas/request-schemas.js";
import type { LlmResponse, SpeechSynthesisResult } from "../types/common.js";
import type { SpeechSynthesizeRequest } from "../types/requests.js";
import { RequestRouter } from "../core/request-router.js";

/**
 * Text-to-speech capability service.
 */
export class SpeechCapability {
  private static readonly DEFAULT_CONVERSION_TIMEOUT_MS = 15_000;

  constructor(private readonly requestRouter: RequestRouter) {}

  private isWithinRoot(root: string, target: string): boolean {
    const pathRelative = relative(root, target);
    return pathRelative === "" || (!pathRelative.startsWith("..") && !isAbsolute(pathRelative));
  }

  private resolveSafeOutputPath(requestedPath: string): string {
    const resolvedTarget = resolve(requestedPath);
    const allowedRoots = [resolve(process.cwd()), resolve(tmpdir())];
    const allowed = allowedRoots.some((root) => this.isWithinRoot(root, resolvedTarget));

    if (!allowed) {
      throw new Error("outputPath must be within the working directory or OS temporary directory");
    }

    return resolvedTarget;
  }

  private isWavBuffer(audioData: Buffer): boolean {
    return (
      audioData.length >= 12 &&
      audioData.subarray(0, 4).toString("ascii") === "RIFF" &&
      audioData.subarray(8, 12).toString("ascii") === "WAVE"
    );
  }

  private async convertWavToMp3(wavData: Buffer, timeoutMs: number): Promise<Buffer> {
    return await new Promise<Buffer>((resolve, reject) => {
      // Encode WAV bytes to MP3 via ffmpeg to keep conversion quality/provider parity.
      const ffmpeg = spawn("ffmpeg", ["-y", "-f", "wav", "-i", "pipe:0", "-f", "mp3", "pipe:1"]);
      const outputChunks: Buffer[] = [];
      const errorChunks: Buffer[] = [];
      let settled = false;

      const timeout = setTimeout(() => {
        ffmpeg.kill("SIGKILL");
        if (!settled) {
          settled = true;
          reject(new Error(`Gemini MP3 conversion timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      const finish = (handler: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        handler();
      };

      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        outputChunks.push(chunk);
      });

      ffmpeg.stderr.on("data", (chunk: Buffer) => {
        errorChunks.push(chunk);
      });

      ffmpeg.on("error", (error) => {
        finish(() => {
          reject(new Error(`Failed to start ffmpeg for Gemini MP3 conversion: ${error.message}`));
        });
      });

      ffmpeg.on("close", (code) => {
        finish(() => {
          if (code !== 0) {
            const stderr = Buffer.concat(errorChunks).toString("utf8").trim();
            reject(new Error(`Gemini MP3 conversion failed with ffmpeg (exit ${code}): ${stderr}`));
            return;
          }

          resolve(Buffer.concat(outputChunks));
        });
      });

      ffmpeg.stdin.end(wavData);
    });
  }

  private toWavFromPcm(
    pcmData: Buffer,
    sampleRate = 24000,
    channels = 1,
    bitsPerSample = 16,
  ): Buffer {
    const headerSize = 44;
    const blockAlign = (channels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length;
    const buffer = Buffer.alloc(headerSize + dataSize);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    pcmData.copy(buffer, headerSize);
    return buffer;
  }

  async synthesize(request: SpeechSynthesizeRequest): Promise<LlmResponse<SpeechSynthesisResult>> {
    try {
      const parsedRequest = speechSynthesizeRequestSchema.parse(request);
      const rawResponse = await this.requestRouter.routeSpeech(parsedRequest);

      if (parsedRequest.outputPath) {
        const safeOutputPath = this.resolveSafeOutputPath(parsedRequest.outputPath);
        const audioBuffer = Buffer.from(rawResponse.content.audio, "base64");
        const extension = extname(parsedRequest.outputPath).toLowerCase();
        const isGemini = rawResponse.model.provider === "gemini";
        const isAlreadyWav = this.isWavBuffer(audioBuffer);
        const conversionTimeoutMs = parsedRequest.timeoutMs ?? SpeechCapability.DEFAULT_CONVERSION_TIMEOUT_MS;

        let fileBuffer: Uint8Array = audioBuffer;

        if (isGemini && extension === ".wav" && !isAlreadyWav) {
          fileBuffer = this.toWavFromPcm(audioBuffer);
        }

        if (isGemini && extension === ".mp3") {
          const wavBuffer = isAlreadyWav ? audioBuffer : this.toWavFromPcm(audioBuffer);
          fileBuffer = await this.convertWavToMp3(wavBuffer, conversionTimeoutMs);
        }

        await mkdir(dirname(safeOutputPath), { recursive: true });
        await writeFile(safeOutputPath, fileBuffer);
      }

      return {
        ...rawResponse,
        content: {
          ...rawResponse.content,
          outputPath: parsedRequest.outputPath,
        },
        metadata: {
          ...rawResponse.metadata,
          ...(parsedRequest.outputPath ? { outputPath: parsedRequest.outputPath } : {}),
        },
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new RequestValidationError("speech", error.flatten());
      }
      throw error;
    }
  }
}