import test from "node:test"
import assert from "node:assert/strict"
import {
	CATALOG, EMPTY_ADDRESS, calculateTotals, findPromo,
	getCartError, updateQuantity, validateAddress,
} from "./checkoutModel.js"

// Tutti i contatti sono esempi fittizi, senza dati personali reali.
const validAddress = {
	email: "utente@example.test",
	firstName: "Nome",
	lastName: "Esempio",
	address: "Via Esempio 1",
	city: "Roma",
	zip: "00100",
	province: "RM",
}
const product = { id: "test-sku", name: "Prodotto demo", price: 19.99, qty: 1 }

test("l'indirizzo vuoto segnala tutti i campi obbligatori, non la provincia", () => {
	assert.deepEqual(Object.keys(validateAddress(EMPTY_ADDRESS)), ["email", "firstName", "lastName", "address", "city", "zip"])
})

test("l'indirizzo accetta spazi esterni, CAP con zero iniziale e provincia facoltativa", () => {
	assert.deepEqual(validateAddress(validAddress), {})
	assert.deepEqual(validateAddress({ ...validAddress, email: " utente@example.test ", province: "" }), {})
	assert.deepEqual(validateAddress({ ...validAddress, province: " rm " }), {})
})

test("email, CAP e provincia non validi hanno messaggi specifici", () => {
	for (const email of ["nome@", "nome con spazi@example.test", "nome@@example.test", "nome@example"]) {
		assert.ok(validateAddress({ ...validAddress, email }).email)
	}
	for (const zip of ["0010", "001000", "00A00"]) {
		assert.ok(validateAddress({ ...validAddress, zip }).zip)
	}
	assert.ok(validateAddress({ ...validAddress, province: "12" }).province)
	assert.ok(validateAddress({ ...validAddress, firstName: "   " }).firstName)
})

test("i totali demo conservano IVA esclusa, aliquota e costi di spedizione esistenti", () => {
	assert.deepEqual(calculateTotals(CATALOG), {
		subtotal: 351, discount: 0, vat: 77.22, shipping: 0, total: 428.22,
	})
	assert.equal(calculateTotals(CATALOG, "express").total, 438.12)
})

test("sconti e IVA sono arrotondati in centesimi", () => {
	assert.deepEqual(calculateTotals(CATALOG, "express", "SANDBOX10"), {
		subtotal: 351, discount: 35.1, vat: 69.5, shipping: 9.9, total: 395.3,
	})
	assert.equal(calculateTotals(CATALOG, "standard", "MFE20").total, 342.58)
	assert.equal(calculateTotals([{ ...product, price: 0.1, qty: 3 }]).total, 0.37)
	assert.equal(calculateTotals([product], "standard", "SANDBOX10").total, 21.95)
})

test("il carrello vuoto non ha spese di spedizione né totale pagabile", () => {
	assert.equal(getCartError([]), null)
	assert.deepEqual(calculateTotals([], "express", "SANDBOX10"), {
		subtotal: 0, discount: 0, vat: 0, shipping: 0, total: 0,
	})
})

test("carrelli e importi malformati non producono totali", () => {
	for (const items of [null, undefined, {}, [null], [{ ...product, id: "" }], [{ ...product, name: "" }], [product, product]]) {
		assert.ok(getCartError(items))
		assert.equal(calculateTotals(items), null)
	}
	for (const price of [-1, NaN, Infinity, "19.99"]) {
		assert.equal(calculateTotals([{ ...product, price }]), null)
	}
	for (const qty of [0, -1, 1.5, NaN, Infinity, "1"]) {
		assert.equal(calculateTotals([{ ...product, qty }]), null)
	}
	assert.equal(calculateTotals([{ ...product, price: Number.MAX_SAFE_INTEGER }]), null)
	assert.equal(calculateTotals([{ ...product, price: Number.MAX_SAFE_INTEGER / 100 }]), null)
	assert.equal(calculateTotals([product], "non-supportata"), null)
})

test("i codici promo sono normalizzati e non includono proprietà del prototipo", () => {
	assert.equal(findPromo(" sandbox10 "), "SANDBOX10")
	assert.equal(findPromo("mfe20"), "MFE20")
	for (const code of ["", "SCONTO", "__proto__", "constructor", "toString"]) {
		assert.equal(findPromo(code), null)
		assert.equal(calculateTotals([product], "standard", code).discount, 0)
	}
})

test("le quantità si aggiornano solo localmente e l'ultima riduzione svuota il carrello", () => {
	const original = Object.freeze([Object.freeze({ ...product })])
	const next = updateQuantity(original, product.id, 1)
	assert.equal(next[0].qty, 2)
	assert.equal(original[0].qty, 1)
	assert.deepEqual(updateQuantity(original, product.id, -1), [])
	assert.equal(updateQuantity(original, product.id, 0), original)
	assert.equal(updateQuantity(null, product.id, 1), null)
	const excessive = [{ ...product, price: 0, qty: Number.MAX_SAFE_INTEGER }]
	assert.equal(updateQuantity(excessive, product.id, 1), excessive)
})
