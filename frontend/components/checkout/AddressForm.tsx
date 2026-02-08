"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddressData {
  full_name: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
}

interface AddressFormProps {
  data: AddressData;
  onChange: (data: AddressData) => void;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export function AddressForm({ data, onChange }: AddressFormProps) {
  const update = (field: keyof AddressData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="full_name" className="text-xs">Full Name</Label>
          <Input
            id="full_name"
            value={data.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            placeholder="John Doe"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="email" className="text-xs">Email</Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="john@example.com"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="address_line1" className="text-xs">Address Line 1</Label>
          <Input
            id="address_line1"
            value={data.address_line1}
            onChange={(e) => update("address_line1", e.target.value)}
            placeholder="123 Main St"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="address_line2" className="text-xs">Address Line 2</Label>
          <Input
            id="address_line2"
            value={data.address_line2}
            onChange={(e) => update("address_line2", e.target.value)}
            placeholder="Apt 4B (optional)"
          />
        </div>
        <div>
          <Label htmlFor="city" className="text-xs">City</Label>
          <Input
            id="city"
            value={data.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="Denver"
          />
        </div>
        <div>
          <Label htmlFor="state" className="text-xs">State</Label>
          <Select value={data.state} onValueChange={(v) => update("state", v)}>
            <SelectTrigger>
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="zip_code" className="text-xs">ZIP Code</Label>
          <Input
            id="zip_code"
            value={data.zip_code}
            onChange={(e) => update("zip_code", e.target.value)}
            placeholder="80202"
          />
        </div>
      </div>
    </div>
  );
}
