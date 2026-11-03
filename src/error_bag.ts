/**
 * Shape of one entry in a VineJS `SimpleErrorReporter` response,
 * which is what Adonis returns for 422 JSON responses by default.
 */
export interface ValidationIssue {
  message: string
  field: string
  rule: string
  index?: number
  meta?: Record<string, any>
}

/**
 * Field name -> messages, in the order the server sent them
 */
export type ErrorBag<Field extends string = string> = Partial<Record<Field, string[]>>

function issuesOf(error: unknown): ValidationIssue[] | undefined {
  if (!error || typeof error !== 'object') return undefined
  const { status, response } = error as { status?: unknown; response?: any }
  if (status !== 422) return undefined
  const errors = response?.errors
  return Array.isArray(errors) ? errors : undefined
}

/**
 * Groups the errors of a 422 VineJS validation response by field.
 * Returns `{}` for anything else (other statuses, network errors, `null`),
 * so it is safe to call on any `error` value.
 *
 * Nested fields keep VineJS's dotted names, e.g. `'items.0.name'`.
 *
 * @example
 * const { error } = useMutation(api.users.store.mutationOptions())
 * const errors = computed(() => toErrorBag<'email' | 'password'>(error.value))
 * // errors.value.email?.[0]
 */
export function toErrorBag<Field extends string = string>(error: unknown): ErrorBag<Field> {
  const bag: Record<string, string[]> = {}
  for (const issue of issuesOf(error) ?? []) {
    ;(bag[issue.field] ??= []).push(issue.message)
  }
  return bag as ErrorBag<Field>
}

/**
 * First message per field. Handy for forms that show one message under each input.
 */
export function firstErrors<Field extends string = string>(
  error: unknown,
): Partial<Record<Field, string>> {
  const first: Record<string, string> = {}
  for (const issue of issuesOf(error) ?? []) {
    first[issue.field] ??= issue.message
  }
  return first as Partial<Record<Field, string>>
}
