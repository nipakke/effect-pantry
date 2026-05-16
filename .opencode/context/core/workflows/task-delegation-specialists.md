<!-- Context: workflows/delegation-specialists | Priority: high | Version: 1.0 | Updated: 2026-02-05 -->

# When to Delegate to Specialists

**Purpose**: Guidance on when to delegate to specific specialist agents

---


---

## TestEngineer - Test Authoring

**✅ DELEGATE when:**

- Writing comprehensive test suites
- TDD workflows (tests before implementation)
- Complex test scenarios (edge cases, error handling)
- Integration tests across multiple components

**Delegation pattern:**

```javascript
task(
  subagent_type="TestEngineer",
  description="Write tests for {feature}",
  prompt="Load context from .tmp/sessions/{session-id}/context.md

  Write comprehensive tests for {feature}
  Files to test: {file list}
  Follow test coverage standards from context."
)
```

---

## CodeReviewer - Quality Assurance

**✅ DELEGATE when:**

- Reviewing complex implementations
- Security-critical code review
- Pre-merge quality checks
- Architecture validation

**Delegation pattern:**

```javascript
task(
  subagent_type="CodeReviewer",
  description="Review {feature}",
  prompt="Load context from .tmp/sessions/{session-id}/context.md

  Review {feature} against standards
  Files: {file list}
  Focus: security, performance, maintainability"
)
```

---

## CoderAgent - Focused Implementation

**✅ DELEGATE when:**

- Implementing atomic subtasks from TaskManager
- Isolated feature work (single component/module)
- Following specific implementation specs

**Delegation pattern:**

```javascript
task(
  subagent_type="CoderAgent",
  description="Implement {subtask}",
  prompt="Load context from .tmp/sessions/{session-id}/context.md

  Implement subtask: {description}
  Follow implementation spec exactly.
  Mark subtask complete when done."
)
```

---

## Decision Matrix

| Scenario                   | Agent                    | Why                      |
| -------------------------- | ------------------------ | ------------------------ |
| Test suite for auth        | TestEngineer             | Comprehensive coverage   |
| Security review            | CodeReviewer             | Security focus           |
| Single API endpoint        | CoderAgent               | Focused implementation   |
| Complex multi-file feature | TaskManager → CoderAgent | Breakdown then implement |

---

## Key Principle

**TestEngineer and CodeReviewer should ALWAYS receive session context path.** This ensures they review against the same standards used during implementation.

---

## Related

- `task-delegation-basics.md` - Core delegation workflow
- `task-delegation-caching.md` - Context caching
- `component-planning.md` - Feature decomposition workflow
