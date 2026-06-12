import { useState } from 'react'
import client from '../api/client'

export function useEditRFQ() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const editRFQ = async (rfqId, data) => {
    setLoading(true)
    setError(null)
    setFieldErrors({})
    try {
      const { data: rfq } = await client.put(`/rfq/${rfqId}`, data)
      return rfq
    } catch (err) {
      if (err.response?.status === 422) {
        const errors = {}
        for (const e of err.response.data.detail ?? []) {
          const field = e.loc?.[e.loc.length - 1]
          if (field) errors[field] = e.msg
        }
        setFieldErrors(errors)
      } else {
        setError('Something went wrong.')
      }
      return null
    } finally {
      setLoading(false)
    }
  }

  return { editRFQ, loading, error, fieldErrors }
}
