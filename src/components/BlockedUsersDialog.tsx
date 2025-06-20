import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useBlock } from "@/hooks/useBlock";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BlockedUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BlockedUsersDialog = ({ open, onOpenChange }: BlockedUsersDialogProps) => {
  const { blockedUserIds, unblockUser } = useBlock();
  const { toast } = useToast();

  const fetchBlockedProfiles = async () => {
    if (!blockedUserIds || blockedUserIds.length === 0) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, first_name')
      .in('user_id', blockedUserIds);
    if (error) throw new Error(error.message);
    return data;
  };

  const { data: blockedProfiles, isLoading, isError } = useQuery({
    queryKey: ['blockedProfiles', blockedUserIds],
    queryFn: fetchBlockedProfiles,
    enabled: open && blockedUserIds.length > 0,
  });

  const handleUnblock = async (userId: string, userName: string) => {
    try {
      await unblockUser(userId);
      toast({
        title: "User Unblocked",
        description: `You have unblocked ${userName}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to unblock user.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Blocked Users</DialogTitle>
          <DialogDescription>
            Here you can see all the users you've blocked and choose to unblock them.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-80 overflow-y-auto">
          {isLoading && <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}
          {isError && <p className="text-red-500">Failed to load blocked users.</p>}
          {!isLoading && !isError && (
            blockedProfiles && blockedProfiles.length > 0 ? (
              <ul className="space-y-3">
                {blockedProfiles.map(profile => (
                  <li key={profile.user_id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                    <span className="text-white">{profile.first_name}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">Unblock</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unblock {profile.first_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            They will be able to see you in matches and chats again. Are you sure?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleUnblock(profile.user_id, profile.first_name)}>
                            Unblock
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center text-gray-400 py-8">
                <UserX className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <p>You haven't blocked any users.</p>
              </div>
            )
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BlockedUsersDialog;