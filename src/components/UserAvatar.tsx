import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  url?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizes = { xs: "h-5 w-5 text-[9px]", sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" };

export function UserAvatar({ name, url, size = "md", className }: UserAvatarProps) {
  return (
    <Avatar className={cn(sizes[size], className)}>
      {url && <AvatarImage src={url} alt={name ?? ""} />}
      <AvatarFallback className="bg-gradient-brand text-primary-foreground font-medium">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
