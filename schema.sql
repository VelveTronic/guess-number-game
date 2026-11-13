CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  digit_length INTEGER NOT NULL CHECK (digit_length BETWEEN 3 AND 6),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'locking', 'playing', 'done')),
  p1 TEXT NOT NULL,
  p2 TEXT,
  turn TEXT CHECK (turn IN ('1', '2')),
  p1_secret TEXT,
  p2_secret TEXT,
  winner TEXT CHECK (winner IN ('1', '2')),
  turn_seconds INTEGER NOT NULL DEFAULT 45 CHECK (turn_seconds IN (30, 45, 60, 90)),
  deadline TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS turn_seconds INTEGER NOT NULL DEFAULT 45;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS guesses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  seat TEXT NOT NULL CHECK (seat IN ('1', '2')),
  guess TEXT NOT NULL,
  hits INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guesses_room_idx ON guesses (room_code, id);

CREATE TABLE IF NOT EXISTS queue (
  player_id TEXT PRIMARY KEY,
  digit_length INTEGER NOT NULL CHECK (digit_length BETWEEN 3 AND 6),
  heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  room_code TEXT,
  seat TEXT CHECK (seat IN ('1', '2'))
);
