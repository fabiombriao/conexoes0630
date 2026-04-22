import React from "react";
import { Navigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useTermCommitment } from "@/hooks/useTermCommitment";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const { accountStatus, isPermissionsLoading } = usePermissions();
  const { needsSignature } = useTermCommitment();
  const location = useLocation();

  if (loading || isPermissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (accountStatus === "pending") {
    return <Navigate to="/pending" replace />;
  }

  if (accountStatus === "rejected") {
    return <Navigate to="/login" replace />;
  }

  if (
    needsSignature &&
    location.pathname !== "/termo-compromisso" &&
    location.pathname !== "/notifications"
  ) {
    return <Navigate to="/termo-compromisso" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
