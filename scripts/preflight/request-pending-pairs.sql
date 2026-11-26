-- Pre-flight for migration 20261031000000_request_pending_partial_unique (B4).
-- READ-ONLY: run with a read-only role and paste the result in the PR.
-- Expected: 0 rows. Any row is a (mentee, mentor) pair with several PENDING
-- requests, which the new partial unique index would reject.

SELECT "fromMenteeId", "toMentorId", COUNT(*) AS pending_count
FROM "MentorshipRequest"
WHERE "status" = 'PENDING'
GROUP BY "fromMenteeId", "toMentorId"
HAVING COUNT(*) > 1;
