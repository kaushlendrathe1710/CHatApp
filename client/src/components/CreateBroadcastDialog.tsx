import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Radio } from "lucide-react";

interface CreateBroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBroadcastDialog({ open, onOpenChange }: CreateBroadcastDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a channel name",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      await apiRequest("POST", "/api/broadcast/create", {
        name: name.trim(),
        description: description.trim(),
      });

      toast({
        title: "Broadcast channel created",
        description: `${name} has been created successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setName("");
      setDescription("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating broadcast channel:", error);
      toast({
        title: "Failed to create channel",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-create-broadcast">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Create Broadcast Channel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel Name</Label>
            <Input
              id="channel-name"
              placeholder="Tech Updates"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-channel-name"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-description">Description (Optional)</Label>
            <Textarea
              id="channel-description"
              placeholder="Latest tech news and updates..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-channel-description"
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-broadcast"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !name.trim()}
              data-testid="button-create-broadcast"
            >
              {isCreating ? "Creating..." : "Create Channel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
