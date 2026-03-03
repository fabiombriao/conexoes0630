import React from "react";

const Logo: React.FC<{ size?: "sm" | "md" | "lg" }> = ({ size = "md" }) => {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <div className={`font-display ${sizes[size]} leading-tight`}>
      <span className="font-normal text-foreground">conexões</span>{" "}
      <span className="font-extrabold text-primary">06:30</span>
    </div>
  );
};

export default Logo;
