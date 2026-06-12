import { useState } from 'react'
import client from '../api/client'

export function useEditQuote(onSuccess) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const editQuote = async (quoteId, formData) => {
    setLoading(true)
    setError(null)
    setFieldErrors({})
    try {
      await client.put(`/quote/${quoteId}`, formData)
      onSuccess()
      return true
    } catch (err) {
      if (err.response?.status === 422) {
        const errors = {}
        for (const e of err.response.data.detail ?? []) {
          const field = e.loc?.[e.loc.length - 1]
          if (field) errors[field] = e.msg
        }
        setFieldErrors(errors)
      } else {
        setError('Something went wrong. Please try again.')
      }
      return false
    } finally {
      setLoading(false)
    }
  }

  return { editQuote, loading, error, fieldErrors }
}
