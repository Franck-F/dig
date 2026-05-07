# Documentation opérationnelle

Procédures de configuration plateforme (GitHub, Vercel, Supabase) qui
sortent du périmètre du code mais doivent être appliquées par un humain
ayant les accès admin.

## Sommaire

| Fichier                                              | Responsable | Quand                                         |
| ---------------------------------------------------- | ----------- | --------------------------------------------- |
| [`branch-protection.md`](./branch-protection.md)     | Tech Lead   | À configurer T+0 sur le repo `dig`            |
| [`staging-environment.md`](./staging-environment.md) | Tech Lead   | À configurer avant la première démo externe   |

Voir aussi les runbooks d'incident dans [`../runbooks/`](../runbooks/) pour
les procédures réactives (rotation de secrets, notification de violation).
