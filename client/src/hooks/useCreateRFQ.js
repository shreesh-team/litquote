import { useState } from 'react'
import { useNavigate } from 'react-router'
import client from '../api/client'

export function useCreateRFQ() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const createRFQ = async (data) => {
    setLoading(true)
    setError(null)
    setFieldErrors({})
    try {
      const { data: rfq } = await client.post('/rfq', data)
      navigate(`/rfq/${rfq.id}`)
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
    } finally {
      setLoading(false)
    }
  }

  return { createRFQ, loading, error, fieldErrors }
}
