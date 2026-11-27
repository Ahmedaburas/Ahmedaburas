# Dev.Ag UX audit playbook

## Surfaces

1. **Customer** — book → match partner → track → quote → pay → rate  
2. **Provider** — leads → assign → Control Tower → quotes → invite techs → billing  
3. **Technician** — accept → navigate/GPS → quote → complete  
4. **Admin** — overview, people, pricing, reports  
5. **API** — auth, tenant authz, rate limits, payload caps  

## Checklist

- Empty states have a next action  
- Forms collect every required field (no hidden required state)  
- Detail routes show the detail, not a wrong page  
- Loading indicators on auth bootstrap  
- Mobile nav reachable  
- EN/AR strings for new UI  
- Errors readable (not raw JSON)  
- Photos / uploads capped  
- Login abuse throttled  
- Password hashing ≥ bcrypt 10  

## Report rule

Always separate **fixed now** vs **deferred**, with user-impact rationale.
