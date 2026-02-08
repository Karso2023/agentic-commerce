"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  MapPin,
  ShoppingBag,
  CheckCircle,
  PartyPopper,
  Copy,
  Store,
} from "lucide-react";
import { AddressForm } from "./AddressForm";
import { PaymentForm } from "./PaymentForm";
import { RetailerCheckoutStepCard } from "./RetailerCheckoutStep";
import type { Cart, CheckoutResult, UserInfo } from "@/lib/types";
import { planCheckout, executeCheckout } from "@/lib/api";

interface CheckoutFlowProps {
  cart: Cart;
  onBack: () => void;
}

type Step = "address" | "payment" | "review" | "complete";

const STEPS: Step[] = ["address", "payment", "review", "complete"];

export function CheckoutFlow({ cart, onBack }: CheckoutFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>("address");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const [address, setAddress] = useState({
    full_name: "",
    email: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
  });

  const [payment, setPayment] = useState({
    card_number: "",
    expiry: "",
    cvv: "",
  });

  const stepIndex = STEPS.indexOf(currentStep);
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;

  const canProceed = () => {
    if (currentStep === "address") {
      return (
        address.full_name &&
        address.email &&
        address.address_line1 &&
        address.city &&
        address.state &&
        address.zip_code
      );
    }
    if (currentStep === "payment") {
      return payment.card_number && payment.expiry && payment.cvv;
    }
    return true;
  };

  const handleNext = async () => {
    if (currentStep === "address") {
      setCurrentStep("payment");
    } else if (currentStep === "payment") {
      setCurrentStep("review");
    } else if (currentStep === "review") {
      await handleCheckout();
    }
  };

  const handleBack = () => {
    if (currentStep === "payment") setCurrentStep("address");
    else if (currentStep === "review") setCurrentStep("payment");
    else onBack();
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      const userInfo: UserInfo = {
        ...address,
        country: "US",
        card_last_four: payment.card_number.slice(-4),
      };
      const plan = await planCheckout(cart, userInfo);
      const checkoutResult = await executeCheckout(plan);
      setResult(checkoutResult);
      setCurrentStep("complete");
    } catch (error) {
      console.error("Checkout failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const stepIcons = {
    address: MapPin,
    payment: CreditCard,
    review: ShoppingBag,
    complete: CheckCircle,
  };

  const stepLabels = {
    address: "Shipping Address",
    payment: "Payment",
    review: "Review & Confirm",
    complete: "Order Confirmed",
  };

  const Icon = stepIcons[currentStep];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 space-y-3 shrink-0">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-500" />
          <h2 className="text-sm font-semibold">{stepLabels[currentStep]}</h2>
        </div>
        <Progress value={progressPct} className="h-1.5" />
        <div className="flex justify-between text-xs text-muted-foreground">
          {STEPS.map((step) => (
            <span
              key={step}
              className={step === currentStep ? "text-foreground font-medium" : ""}
            >
              {stepLabels[step]}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {currentStep === "address" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground flex items-start gap-2">
              <Copy className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Enter your shipping address once. The agent will reuse it for all retailers.</span>
            </div>
            <AddressForm data={address} onChange={setAddress} />
          </div>
        )}

        {currentStep === "payment" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground flex items-start gap-2">
              <CreditCard className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Enter payment once. No real charge — this is a simulated checkout. Your details are applied automatically at each retailer.</span>
            </div>
            <PaymentForm data={payment} onChange={setPayment} />
          </div>
        )}

        {currentStep === "review" && (
          <div className="space-y-4">
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500" />
                  Payment + address entered once
                </p>
                <p className="text-sm text-muted-foreground">
                  The agent will fan out and complete a <strong>simulated</strong> checkout step at each retailer. Your address and payment are auto-filled at every store — no real purchase is made.
                </p>
                <Badge variant="secondary" className="text-xs">Sandbox / demo only</Badge>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4" />
              Step-by-step checkout plan ({cart.retailers_involved.length} retailers)
            </p>
            {cart.retailers_involved.map((retailer) => {
              const items = cart.items.filter(
                (i) => i.selected.product.retailer === retailer
              );
              const subtotal = items.reduce(
                (sum, i) => sum + i.selected.product.price,
                0
              );
              return (
                <RetailerCheckoutStepCard
                  key={retailer}
                  step={{
                    retailer,
                    items,
                    subtotal,
                    shipping_cost: 0,
                    estimated_delivery: "3-5 business days",
                    status: isProcessing ? "processing" : "pending",
                    confirmation_number: null,
                  }}
                  isExecuting={isProcessing}
                  autofillPreview="Your address & payment applied (simulated)"
                />
              );
            })}
            <Separator />
            <div className="flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>${cart.total_price.toFixed(2)}</span>
            </div>
          </div>
        )}

        {currentStep === "complete" && result && (
          <div className="space-y-4 text-center py-8">
            <PartyPopper className="h-12 w-12 text-green-500 mx-auto" />
            <h3 className="text-lg font-semibold">Order Confirmed!</h3>
            <p className="text-sm text-muted-foreground">{result.message}</p>
            <p className="text-lg font-bold">
              Total: ${result.total_charged.toFixed(2)}
            </p>
            <Separator />
            <div className="space-y-3 text-left">
              {result.steps.map((step) => (
                <RetailerCheckoutStepCard
                  key={step.retailer}
                  step={step}
                  isExecuting={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {currentStep !== "complete" && (
        <div className="border-t p-4 flex gap-2">
          <Button variant="outline" onClick={handleBack} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isProcessing}
            className="flex-1"
          >
            {currentStep === "review" ? (
              isProcessing ? (
                "Processing..."
              ) : (
                "Place Orders"
              )
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
