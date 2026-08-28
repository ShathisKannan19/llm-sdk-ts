# Architecture Guidelines

## Purpose

Design software that is modular, maintainable, testable, and extensible.

## Principles

- Follow SOLID principles.
- Prefer composition over inheritance.
- Separate business logic from infrastructure.
- Design for extensibility.
- Minimize coupling.
- Maximize cohesion.

## Layering

Separate the application into independent layers.

Example:

Presentation

↓

Application

↓

Domain

↓

Infrastructure

↓

External Services

Each layer should depend only on abstractions.

## Modules

Each module should have a single responsibility.

Avoid large modules with unrelated functionality.

## Dependencies

Depend on interfaces instead of implementations.

Avoid circular dependencies.

## Public API

Keep public APIs simple and stable.

Hide implementation details.

## Extensibility

New features should require adding code instead of modifying existing code whenever possible.

## Maintainability

Prefer clarity over cleverness.

Readable code is more valuable than concise code.