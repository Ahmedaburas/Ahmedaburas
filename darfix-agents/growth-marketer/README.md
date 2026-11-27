# Growth Marketer / Campaign Planner

Peer agent that drafts **Saudi seasonal campaigns** for DARFIX partners (Ramadan, Eids, National Day, Founding Day, White Friday, back-to-school, summer AC).

- **Does:** content calendar, co-marketing offers, customer promo drafts
- **Does not:** auto-publish paid ads or change live pricing

## Run

```bash
# With other peers
cd .. && npx @grok/agent-sdk dev .
# Playground: http://127.0.0.1:3000/growth-marketer
```

Skill: `bot/skills/saudi-campaign-calendar.md`  
API mirror: `GET /api/org/campaigns/suggestions` (Control Tower UI)
