-- The browser never accesses CRM records directly. RLS without public policies
-- keeps the Supabase Data API closed while the NestJS database role remains the
-- only application access path.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Consultant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ClientConsultant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ClientPersonnel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."File" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ClientDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Mission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MissionConsultant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrdreMission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrdreMissionConsultant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrdreMissionTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrdreMissionReferenceCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SyncMutation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SyncConflict" ENABLE ROW LEVEL SECURITY;
