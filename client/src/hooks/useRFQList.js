import { useState, useEffect, useCallback } from 'react'
import client from '../api/client'

export function useRFQList(limit = 20) {
  const [rfqs, setRFQs] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async (off = offset) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await client.get('/rfq', { params: { limit, offset: off } })
      setRFQs(data.items)
      setTotal(data.total)
      setOffset(off)
    } catch {
      setError('Failed to load RFQs.')
    } finally {
      setLoading(false)
    }
  }, [limit, offset])

  useEffect(() => { fetch(0) }, [limit]) // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = () => fetch(offset)

  const deleteRFQ = async (id) => {
    if (!window.confirm('Delete this RFQ and all its quotes?')) return
    try {
      await client.delete(`/rfq/${id}`)
      await fetch(offset)
    } catch (err) {
      if (err.response?.status === 404) {
        await fetch(offset)
      } else {
        setError('Failed to delete RFQ.')
      }
    }
  }

  const goToPage = (newOffset) => fetch(newOffset)

  return { rfqs, total, offset, limit, loading, error, refetch, deleteRFQ, goToPage }
}
