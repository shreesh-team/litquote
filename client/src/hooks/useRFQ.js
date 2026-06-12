import { useState, useEffect } from 'react'
import client from '../api/client'

export function useRFQ(id) {
  const [rfq, setRFQ] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    client.get(`/rfq/${id}`)
      .then(({ data }) => setRFQ(data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('RFQ not found.')
        } else {
          setError('Failed to load RFQ.')
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  return { rfq, loading, error, setRFQ }
}
