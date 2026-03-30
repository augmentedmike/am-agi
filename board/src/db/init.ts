// init.ts — create board.db and run migrations if it doesn't exist yet
// Called by install.sh via: npm run db:init
import { getDb } from './client';

getDb();
process.exit(0);
