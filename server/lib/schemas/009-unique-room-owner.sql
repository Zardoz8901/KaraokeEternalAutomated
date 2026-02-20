-- Up
-- Clean up any pre-existing duplicate rooms (keep oldest per owner).
-- First delete queue rows for rooms that will be removed to avoid orphans.
DELETE FROM queue
WHERE roomId IN (
  SELECT roomId FROM rooms
  WHERE ownerId IS NOT NULL
    AND rowid NOT IN (
      SELECT MIN(rowid) FROM rooms
      WHERE ownerId IS NOT NULL
      GROUP BY ownerId
    )
);

DELETE FROM rooms
WHERE ownerId IS NOT NULL
  AND rowid NOT IN (
    SELECT MIN(rowid) FROM rooms
    WHERE ownerId IS NOT NULL
    GROUP BY ownerId
  );

-- Partial unique index: one ephemeral room per owner, NULLs (admin rooms) excluded
CREATE UNIQUE INDEX IF NOT EXISTS idxRoomOwnerUnique ON rooms (ownerId) WHERE ownerId IS NOT NULL;

-- Down
DROP INDEX IF EXISTS idxRoomOwnerUnique;
