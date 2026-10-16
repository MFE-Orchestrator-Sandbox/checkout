// Dati e regole esclusivamente dimostrativi: non rappresentano un servizio commerciale.
export const CATALOG = [
	{
		id: "sku-anodized-lamp",
		name: "Lampada Anodized",
		variant: "Alluminio / Warm 2700K",
		price: 149,
		qty: 1,
		emoji: "🛋️",
	},
	{
		id: "sku-linen-throw",
		name: "Plaid in lino lavato",
		variant: "Sabbia / 130x180",
		price: 89,
		qty: 2,
		emoji: "🧺",
	},
	{
		id: "sku-ceramic-mug",
		name: "Tazza in gres",
		variant: "Verde salvia / 350ml",
		price: 24,
		qty: 1,
		emoji: "☕",
	},
]

export const SHIPPING_METHODS = [
	{ id: "standard", label: "Standard", eta: "Stima demo: 3–5 giorni lavorativi", price: 0 },
	{ id: "express", label: "Express", eta: "Stima demo: 1–2 giorni lavorativi", price: 9.9 },
]

export const PROMOS = {
	SANDBOX10: { label: "Sconto demo 10%", rate: 0.1 },
	MFE20: { label: "Sconto demo 20%", rate: 0.2 },
}

export const EMPTY_ADDRESS = {
	email: "",
	firstName: "",
	lastName: "",
	address: "",
	city: "",
	zip: "",
	province: "",
}

export const eur = (n) =>
	new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n)

export const findPromo = (input) => {
	const code = input.trim().toUpperCase()
	return Object.hasOwn(PROMOS, code) ? code : null
}

export const validateAddress = (address) => {
	const errors = {}
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email.trim())) {
		errors.email = "Inserisci un indirizzo email valido."
	}
	if (!address.firstName.trim()) errors.firstName = "Inserisci il nome."
	if (!address.lastName.trim()) errors.lastName = "Inserisci il cognome."
	if (!address.address.trim()) errors.address = "Inserisci via e numero civico."
	if (!address.city.trim()) errors.city = "Inserisci la città."
	if (!/^\d{5}$/.test(address.zip.trim())) errors.zip = "Il CAP deve contenere 5 cifre."
	if (address.province.trim() && !/^[A-Z]{2}$/i.test(address.province.trim())) {
		errors.province = "Usa una sigla di 2 lettere, ad esempio RM."
	}
	return errors
}

export const getCartError = (items) => {
	if (!Array.isArray(items)) return "Il carrello non è disponibile. Riprova dalla shell."
	const ids = new Set()
	let subtotal = 0
	for (const item of items) {
		if (
			!item ||
			typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) ||
			typeof item.name !== "string" || !item.name.trim() ||
			typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0 ||
			!Number.isSafeInteger(item.qty) || item.qty <= 0
		) return "Non è possibile leggere alcuni prodotti. Aggiorna il carrello dalla shell."
		ids.add(item.id)
		const cents = Math.round(item.price * 100)
		const line = cents * item.qty
		subtotal += line
		if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(line) || !Number.isSafeInteger(subtotal)) {
			return "Gli importi del carrello non sono validi. Aggiorna il carrello dalla shell."
		}
	}
	return null
}

export const calculateTotals = (items, shipping = "standard", promo = null) => {
	if (getCartError(items)) return null
	const method = SHIPPING_METHODS.find((m) => m.id === shipping)
	if (!method) return null
	// Calcolo in centesimi: prezzi demo al netto dell'IVA, come nel checkout originale.
	const subtotal = items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.qty, 0)
	const discount = promo && Object.hasOwn(PROMOS, promo)
		? Math.round(subtotal * PROMOS[promo].rate)
		: 0
	const vat = Math.round((subtotal - discount) * 0.22)
	const delivery = items.length ? Math.round(method.price * 100) : 0
	const total = subtotal - discount + vat + delivery
	if (!Number.isSafeInteger(total)) return null
	return {
		subtotal: subtotal / 100,
		discount: discount / 100,
		vat: vat / 100,
		shipping: delivery / 100,
		total: total / 100,
	}
}

export const updateQuantity = (items, id, delta) => {
	if (getCartError(items) || (delta !== 1 && delta !== -1)) return items
	const next = items
		.map((item) => item.id === id ? { ...item, qty: item.qty + delta } : item)
		.filter((item) => item.qty > 0)
	return calculateTotals(next) ? next : items
}
