# cnrkuo/yato-judge

**YATO Judge** stands for **Y**et **A**nother **T**rashy **O**nline **Judge**, an open-source online judge with problems, automatic judging, contests with live scoreboards, and training scoreboards. It is a TypeScript monorepo with a C++ judge: a shared [oRPC](https://orpc.dev/) contract connects a [NestJS](https://nestjs.com/) API and a server-rendered [React Router](https://reactrouter.com/) Web app, and judge machines run each submission in an [nsjail](https://github.com/google/nsjail) sandbox.

| Part | Stack |
| --- | --- |
| Contract | oRPC, ArkType |
| API | NestJS 12, Fastify, Drizzle ORM, PostgreSQL 18, RabbitMQ 4 |
| Web | React Router 8, React 19, Bootstrap 5.3, TanStack Query & Table |
| Judge | C++, nsjail; GCC, Clang, Python |
| Deployment | Docker Compose |

You can try it right now on <https://oj.cnrkuo.cc>.

## Installation

For most users, the most convinient way of getting it running is Docker Compose:

1. Install [Docker](https://www.docker.com/), [Docker Compose](https://docs.docker.com/compose/), [Node.js](https://nodejs.org/) v26 and [PNPM](https://pnpm.io/) v12. A `.tool-versions` file is is provided so that [asdf](https://asdf-vm.com/) can pin the versions of the latter two.
2. Run `pnpm install`.
3. Run `pnpm run docker:prod`.

You should see the system up and running after these steps. Postgres and RabbitMQ will start alongside the Web app, API server and judge container with automatic configuration.

Although YATO is expected to behave properly in any Docker-compatible x86_64 environment, we recommend deploying it on **Debian 13**, as this is the platform on which we mainly run our tests. If your choice of distribution is limited, choose Ubuntu or (open)SUSE, and **avoid distributions that use musl libc by default** (e.g., Alpine Linux).

Manual installation is possible, but not yet practical at this stage of development. Detailed documentation on this will be available soon.

## Credits

&copy; 2026 Conor Kuo et al. Licensed under [Apache 2.0](https://github.com/cnrkuo/yato-judge/blob/master/LICENSE).  
Made with love for the open-source community, with help from [Claude Code](https://claude.com/product/claude-code).
