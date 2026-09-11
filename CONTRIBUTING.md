# Contributing to `rive-backend`

Thank you for contributing to the RIVÉ backend codebase! This guide explains our development standards, branch conventions, testing practices, and Pull Request (PR) workflow so you can work confidently and efficiently.

---

## 📋 Code Style & Architecture Guidelines

1. **NestJS Architecture Pattern**:
   - Keep Controllers light: Controllers handle route definition, request validation via DTOs, and HTTP response formatting.
   - Domain Logic in Services: All business rules, transactions, calculations, and database calls belong in Services.
   - Custom Guards & Decorators: Use NestJS guards (`JwtAuthGuard`, `RolesGuard`, `ThrottlerGuard`) for cross-cutting security checks.

2. **TypeScript & Strict Typing**:
   - Avoid using `any`. Define explicit interfaces, types, or DTOs.
   - DTOs must use `class-validator` and `class-transformer` decorators for runtime validation.

3. **Database & Prisma Practices**:
   - Use Prisma transactions (`prisma.$transaction`) whenever multiple database mutations depend on each other (e.g., updating order status and restoring stock).
   - Do not edit raw migration files after they have been committed or deployed. Create a new migration with `npx prisma migrate dev --name <description>`.

4. **Comments & Documentation**:
   - Write self-documenting code.
   - Add targeted comments on complex business logic answering **"why"** something is done rather than **"what"** it does.

---

## 🌿 Branch Naming Conventions

All branch names should be descriptive and use lowercase with hyphens. Use the following prefixes:

- `feature/<short-description>`: New endpoint or business capability (e.g., `feature/product-variant-discount`).
- `fix/<short-description>`: Bug fix (e.g., `fix/inventory-restoration-lock`).
- `docs/<short-description>`: Documentation changes (e.g., `docs/update-readme`).
- `refactor/<short-description>`: Code cleanup or refactoring without functional logic changes.
- `test/<short-description>`: Adding or modifying test suites.

---

## 💬 Commit Message Conventions

We follow standardized commit conventions (Conventional Commits format):

```
<type>(<scope>): <short summary>

[optional body]
```

### Allowed Types:
- `feat`: A new feature or endpoint.
- `fix`: A bug fix.
- `docs`: Documentation updates.
- `test`: Adding or updating unit/e2e tests.
- `refactor`: Code change that neither fixes a bug nor adds a feature.
- `chore`: Maintenance tasks, dependency updates, configuration changes.

### Example:
```
feat(orders): add idempotency check for Stripe payment webhook

Prevents duplicate status transitions when processing duplicate Stripe payment completion events.
```

---

## 🧪 Local Verification Checklist (Before PR)

Before creating a Pull Request, run all verification checks locally to ensure CI checks pass:

```bash
# 1. Linting & Formatting
npm run lint

# 2. TypeScript Compilation Check
npm run typecheck

# 3. Test Suite Execution
npm test

# 4. Production Build Verification
npm run build
```

---

## 🚀 Pull Request Workflow

1. **Fork/Branch**: Create your branch from `main` using the naming convention above.
2. **Implement & Test**: Make your changes and add corresponding unit/integration tests for new logic.
3. **Verify**: Ensure all local verification commands (`lint`, `typecheck`, `test`, `build`) pass cleanly.
4. **Create PR**:
   - Target the `main` branch.
   - Provide a clear title and description explaining the motivation, changes made, and verification results.
   - Do not self-merge PRs into `main` without review.
