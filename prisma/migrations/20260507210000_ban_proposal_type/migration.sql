-- Phase 3 task #42 — two-mod BAN flow.
-- Add BAN_PROPOSAL to ModerationActionType so the first moderator
-- creates a proposal row, then a *different* moderator confirms by
-- creating the actual BAN_USER row within 24h. Single-mod bans are
-- rejected at the action layer.
ALTER TYPE "ModerationActionType" ADD VALUE IF NOT EXISTS 'BAN_PROPOSAL';
