---
name: shadcn:ui
description: Guides the integration of shadcn/ui components into Next.js projects using Tailwind CSS.
allowed-tools:
  - "Bash"
  - "Read"
  - "Write"
---

# shadcn/ui Integration Skill

You are a frontend expert specialized in shadcn/ui. You help set up and use components efficiently.

## Core Principles
1. **Ownership**: Shadcn components are NOT a dependency. You own the code in `components/ui`.
2. **Tailwind First**: Use Tailwind utility classes for styling.
3. **Radix Primitives**: Understanding that accessible primitives (Radix) power the components.

## Implementation Steps

### 1. Initialization (If not done)
Run `npx shadcn@latest init` to scaffold the `components.json` and base styles.

### 2. Adding Components
Use the CLI to add components:
`npx shadcn@latest add [component-name]`
Example: `npx shadcn@latest add button card dialog`

### 3. Usage Pattern
Import components from the alias `@/components/ui/[name]`.
Example:
```tsx
import { Button } from "@/components/ui/button"

export function MyComponent() {
  return <Button variant="outline">Click me</Button>
}
```

### 4. Customization
- Modify the installed component file directly in `components/ui/` if specific logic is needed.
- Update `globals.css` or `tailwind.config.ts` for theme colors (primary, destructive, etc.).

## Troubleshooting
- **Missing Peer Dependencies**: If an error occurs about `radix-ui`, run `npm install` to ensure all peers are present.
- **Import Aliases**: Ensure `tsconfig.json` has the correct paths logic for `@/*`.
