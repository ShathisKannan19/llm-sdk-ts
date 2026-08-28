# Validation Guidelines

## General

Validate all external input.

Never trust incoming data.

## Configuration

Validate configuration during application startup.

Fail fast when configuration is invalid.

## Requests

Validate before executing business logic.

Reject invalid input early.

## Responses

Return consistent validation errors.

Avoid leaking implementation details.

## Reuse

Reuse validation definitions whenever possible.

Keep validation close to the corresponding models.