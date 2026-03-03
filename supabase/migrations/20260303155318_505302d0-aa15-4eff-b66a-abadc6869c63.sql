
-- Allow system (SECURITY DEFINER functions) to insert notifications
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Helper: create a notification
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _type text,
  _title text,
  _message text,
  _link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, read)
  VALUES (_user_id, _type, _title, _message, _link, false);
END;
$$;

-- Helper: notify all superadmins
CREATE OR REPLACE FUNCTION public.notify_superadmins(
  _type text,
  _title text,
  _message text,
  _link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id uuid;
BEGIN
  FOR _admin_id IN
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    PERFORM create_notification(_admin_id, _type, _title, _message, _link);
  END LOOP;
END;
$$;

-- 1,2,3: Contribution notifications
CREATE OR REPLACE FUNCTION public.on_contribution_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sender_name text;
BEGIN
  SELECT full_name INTO _sender_name FROM profiles WHERE id = NEW.user_id;
  _sender_name := COALESCE(_sender_name, 'Um membro');

  -- Indicação: notify referred_to member
  IF NEW.type = 'referral' AND NEW.referred_to IS NOT NULL THEN
    PERFORM create_notification(
      NEW.referred_to,
      'indicacao',
      'Nova Indicação Recebida 🤝',
      _sender_name || ' fez uma indicação para você: ' || COALESCE(NEW.contact_name, 'novo contato'),
      '/contributions'
    );
  END IF;

  -- Negócio fechado: notify related referral owner
  IF NEW.type = 'onf' AND NEW.related_referral_id IS NOT NULL THEN
    DECLARE
      _referral_owner uuid;
    BEGIN
      SELECT user_id INTO _referral_owner FROM contributions WHERE id = NEW.related_referral_id;
      IF _referral_owner IS NOT NULL AND _referral_owner <> NEW.user_id THEN
        PERFORM create_notification(
          _referral_owner,
          'negocio_fechado',
          'Negócio Fechado! 🎉',
          _sender_name || ' registrou um negócio fechado relacionado à sua indicação: R$ ' || COALESCE(NEW.business_value::text, '0'),
          '/contributions'
        );
      END IF;
    END;
  END IF;

  -- Téte a téte: notify meeting partner
  IF NEW.type = 'one_to_one' AND NEW.meeting_member_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.meeting_member_id,
      'tete_a_tete',
      'Téte a téte Registrado ☕',
      _sender_name || ' registrou um téte a téte com você',
      '/contributions'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contribution_notify
  AFTER INSERT ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION on_contribution_notify();

-- 5,6,7: Attendance session notifications
CREATE OR REPLACE FUNCTION public.on_attendance_session_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _date_str text;
BEGIN
  _date_str := to_char(NEW.session_date, 'DD/MM/YYYY');

  -- Submitted for approval
  IF NEW.status = 'pending_approval' AND (OLD.status IS NULL OR OLD.status <> 'pending_approval') THEN
    PERFORM notify_superadmins(
      'attendance_pending',
      '📋 Lista de Presença Aguardando Aprovação',
      'Uma lista de presença para ' || _date_str || ' foi enviada e aguarda sua aprovação',
      '/admin/pending'
    );
  END IF;

  -- Approved
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    PERFORM create_notification(
      NEW.created_by,
      'attendance_approved',
      '✅ Lista de Presença Aprovada',
      'Sua lista de presença de ' || _date_str || ' foi aprovada!',
      '/attendance'
    );
  END IF;

  -- Rejected
  IF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    PERFORM create_notification(
      NEW.created_by,
      'attendance_rejected',
      '❌ Lista de Presença Rejeitada',
      'Sua lista de presença de ' || _date_str || ' foi rejeitada. Motivo: ' || COALESCE(NEW.rejection_reason, 'Não informado'),
      '/attendance'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attendance_notify
  AFTER UPDATE ON attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION on_attendance_session_notify();

-- 8: New account pending
CREATE OR REPLACE FUNCTION public.on_profile_created_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM notify_superadmins(
      'new_account',
      '👤 Nova Solicitação de Acesso',
      COALESCE(NEW.full_name, 'Novo usuário') || ' solicitou acesso ao Conexões 06:30',
      '/admin/pending'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profile_created_notify
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION on_profile_created_notify();

-- 9,10: Account approved/rejected
CREATE OR REPLACE FUNCTION public.on_profile_status_change_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Approved
  IF NEW.status = 'active' AND OLD.status = 'pending' THEN
    PERFORM create_notification(
      NEW.id,
      'account_approved',
      '🎉 Acesso Aprovado!',
      'Seu cadastro foi aprovado! Bem-vindo ao Conexões 06:30.',
      '/'
    );
  END IF;

  -- Rejected
  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    PERFORM create_notification(
      NEW.id,
      'account_rejected',
      'Solicitação não aprovada',
      'Infelizmente sua solicitação de acesso não foi aprovada neste momento.',
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profile_status_notify
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION on_profile_status_change_notify();
