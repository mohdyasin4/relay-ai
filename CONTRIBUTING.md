# Contributing to Relay AI 🤝

Thank you for your interest in contributing to Relay AI! We welcome contributions from the community and are excited to see what you'll bring to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Code Standards](#code-standards)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/relay-ai.git
   cd relay-ai
   ```
3. **Set up the development environment** (see README.md)
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Fill in your configuration
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

## Making Changes

### Branch Naming Convention
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

### Commit Message Format
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

feat(chat): add message encryption
fix(ui): resolve mobile scrolling issue
docs(readme): update installation guide
```

## Submitting Changes

1. **Ensure your code follows our standards** (see below)
2. **Test your changes** thoroughly
3. **Commit your changes** with descriptive messages
4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Create a Pull Request** on GitHub

### Pull Request Guidelines

- **Describe your changes** clearly in the PR description
- **Reference any related issues** using `#issue-number`
- **Include screenshots** for UI changes
- **Ensure CI checks pass**
- **Request review** from maintainers

## Code Standards

### TypeScript
- Use strict TypeScript configuration
- Provide proper type annotations
- Avoid `any` types when possible

### React
- Use functional components with hooks
- Follow React best practices
- Use proper dependency arrays in useEffect

### CSS/Styling
- Use Tailwind CSS utility classes
- Follow responsive design principles
- Ensure accessibility compliance

### Code Quality
- Write self-documenting code
- Add comments for complex logic
- Keep functions small and focused
- Use meaningful variable names

## Testing

- Write tests for new features
- Ensure existing tests pass
- Aim for good test coverage
- Test on multiple devices/browsers

## Reporting Issues

### Bug Reports
When reporting bugs, please include:
- **Clear description** of the issue
- **Steps to reproduce** the problem
- **Expected vs actual behavior**
- **Environment details** (browser, OS, etc.)
- **Screenshots** if applicable

### Feature Requests
For feature requests, please provide:
- **Clear description** of the feature
- **Use case** and benefits
- **Potential implementation** ideas
- **Mockups** if applicable

## Questions?

If you have questions about contributing, feel free to:
- **Open an issue** for discussion
- **Reach out** to the maintainers
- **Check existing issues** for similar questions

Thank you for contributing to Relay AI! 🚀
