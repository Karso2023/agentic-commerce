"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PaymentData {
  card_number: string;
  expiry: string;
  cvv: string;
}

interface PaymentFormProps {
  data: PaymentData;
  onChange: (data: PaymentData) => void;
}

export function PaymentForm({ data, onChange }: PaymentFormProps) {
  const update = (field: keyof PaymentData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        This is a simulated checkout. No real payment will be processed.
      </p>
      <div>
        <Label htmlFor="card_number" className="text-xs">Card Number</Label>
        <Input
          id="card_number"
          value={data.card_number}
          onChange={(e) => update("card_number", e.target.value)}
          placeholder="4242 4242 4242 4242"
          maxLength={19}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="expiry" className="text-xs">Expiry</Label>
          <Input
            id="expiry"
            value={data.expiry}
            onChange={(e) => update("expiry", e.target.value)}
            placeholder="MM/YY"
            maxLength={5}
          />
        </div>
        <div>
          <Label htmlFor="cvv" className="text-xs">CVV</Label>
          <Input
            id="cvv"
            type="password"
            value={data.cvv}
            onChange={(e) => update("cvv", e.target.value)}
            placeholder="123"
            maxLength={4}
          />
        </div>
      </div>
    </div>
  );
}
