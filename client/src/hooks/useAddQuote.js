import { useState } from 'react'
import client from '../api/client'

export function useAddQuote(rfqId, onSuccess) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const addQuote = async (formData) => {
    setLoading(true)
    setError(null)
    setFieldErrors({})
    try {
      await client.post(`/rfq/${rfqId}/quotes`, formData)
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

  return { addQuote, loading, error, fieldErrors }
}
