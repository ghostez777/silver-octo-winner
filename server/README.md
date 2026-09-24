# GameHub self-hosted PokéRogue backend

This directory prepares a private PokéRogue API server for GameHub.

The upstream PokéRogue project provides a separate Go backend called `rogueserver`. This setup builds that server in Docker and runs it beside MariaDB.

## Important

GitHub Pages cannot run this backend. These files are deployment-ready, but you still need a server/host that can run Docker before the API can be reached by your public GameHub site.

Do not put database passwords in the GameHub frontend or in `games/pokerouge/`.

## First deployment

1. Copy `.env.example` to `.env`.
2. Set strong, unique values for `DB_PASSWORD` and `DB_ROOT_PASSWORD`.
3. Set `GAME_URL` to the HTTPS origin where the PokéRogue client is served.
4. Build and start:

   docker compose up -d --build

5. Check the API container:

   docker compose logs -f api

6. Once a real domain is pointed at this server, put HTTPS in front of port 8001 with a reverse proxy such as Caddy.

## GameHub login

This backend currently provides the normal PokéRogue account system. It does NOT yet accept Supabase JWTs as PokéRogue sessions.

That integration is a separate step: the GameHub frontend must authenticate with Supabase, while a server-side bridge maps the authenticated GameHub user to a PokéRogue account/session without ever receiving the user's Supabase password.

Until that bridge is implemented and the API is publicly reachable, leave the existing GameHub login and PokéRogue login as separate systems.

## Data

The MariaDB data is stored in the named Docker volume `pokerogue-db`, so restarting the containers does not delete accounts.

Back up the database before upgrading the server.

## Upstream project

The backend source is built directly from the Pagefault Games rogueserver repository. It is licensed under AGPL-3.0.
