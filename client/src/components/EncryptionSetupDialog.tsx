import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock, Shield, CheckCircle2 } from "lucide-react";

interface EncryptionSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onEncryptionEnabled: () => void;
}

export function EncryptionSetupDialog({
  open,
  onOpenChange,
  conversationId,
  onEncryptionEnabled,
}: EncryptionSetupDialogProps) {
  const [isEnabling, setIsEnabling] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      generateKeyPair();
    }
  }, [open]);

  const generateKeyPair = async () => {
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );

      const publicKeyData = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
      const publicKeyBase64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(publicKeyData))));
      
      const privateKeyData = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
      const privateKeyBase64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(privateKeyData))));

      localStorage.setItem(`encryption_private_key_${conversationId}`, privateKeyBase64);
      setPublicKey(publicKeyBase64);
    } catch (error) {
      console.error("Error generating key pair:", error);
      toast({
        title: "Encryption Error",
        description: "Failed to generate encryption keys",
        variant: "destructive",
      });
    }
  };

  const enableEncryption = async () => {
    if (!publicKey) {
      toast({
        title: "Error",
        description: "Public key not generated",
        variant: "destructive",
      });
      return;
    }

    setIsEnabling(true);
    try {
      await apiRequest("POST", "/api/encryption/keys", {
        conversationId,
        publicKey,
      });

      toast({
        title: "Encryption Enabled",
        description: "Messages in this conversation will now be encrypted end-to-end",
      });

      onEncryptionEnabled();
      onOpenChange(false);
    } catch (error) {
      console.error("Error enabling encryption:", error);
      toast({
        title: "Failed to enable encryption",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-encryption-setup">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Enable End-to-End Encryption
          </DialogTitle>
          <DialogDescription>
            Secure your messages with end-to-end encryption
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <span>Your messages will be encrypted on your device</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <span>Only participants in this conversation can read messages</span>
            </div>
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-primary mt-0.5" />
              <span>Messages cannot be decrypted by the server or third parties</span>
            </div>
          </div>

          <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground">
            <strong>Note:</strong> Your encryption keys are stored locally. If you clear your browser data, 
            you'll lose access to encrypted messages.
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-encryption"
            >
              Cancel
            </Button>
            <Button
              onClick={enableEncryption}
              disabled={isEnabling || !publicKey}
              data-testid="button-enable-encryption"
            >
              {isEnabling ? "Enabling..." : "Enable Encryption"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
