import { ref, watch } from 'vue'

// 1 USD = KHR rate for Cambodia
export const USD_TO_KHR = 4013

// Module-level singleton so all components share the same value
const currency = ref(localStorage.getItem('currency') || 'USD')

watch(currency, (val) => {
  localStorage.setItem('currency', val)
})

export function useCurrency() {
  const convertAmount = (usdAmount) => {
    return currency.value === 'KHR' ? usdAmount * USD_TO_KHR : usdAmount
  }

  return {
    currency,
    USD_TO_KHR,
    convertAmount
  }
}
