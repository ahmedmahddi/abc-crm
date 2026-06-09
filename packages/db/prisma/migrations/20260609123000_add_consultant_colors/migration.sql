ALTER TABLE "Consultant" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#125885';

WITH numbered AS (
  SELECT
    "id",
    row_number() OVER (ORDER BY "id") AS position
  FROM "Consultant"
)
UPDATE "Consultant"
SET "color" = (
  ARRAY[
    '#125885',
    '#1F7A5A',
    '#C48A1A',
    '#0E476C',
    '#7A868F',
    '#C44545',
    '#2F6F8F',
    '#5F6B7A'
  ]
)[1 + mod((numbered.position - 1)::int, 8)]
FROM numbered
WHERE numbered."id" = "Consultant"."id";
