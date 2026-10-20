export interface ICreatePaymentIntentPayload {
	currency?: string;
}

export interface IConfirmPaymentPayload {
	paymentIntentId: string;
	paymentMethodId?: string;
}

export interface ICreateCheckoutSessionPayload {
	currency?: string;
}

export interface IVerifyCheckoutSessionPayload {
	sessionId: string;
}
