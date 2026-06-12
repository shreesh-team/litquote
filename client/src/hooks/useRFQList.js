import { useState, useEffect, useCallback } from 'react'
import client from '../api/client'

export function useRFQList(limit = 20) {
  const [rfqs, setRFQs] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async (off = 0, search = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit, offset: off }
      if (search) params.search = search
      const { data } = await client.get('/rfq', { params })
      setRFQs(data.items)
      setTotal(data.total)
      setOffset(off)
    } catch {
      setError('Failed to load RFQs.')
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => { fetch(0) }, [limit]) // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = (search = '') => fetch(offset, search)

  const deleteRFQ = async (id, search = '') => {
    try {
      await client.delete(`/rfq/${id}`)
      await fetch(offset, search)
    } catch (err) {
      if (err.response?.status === 404) {
        await fetch(offset, search)
      } else {
        setError('Failed to delete RFQ.')
      }
    }
  }

  const goToPage = (newOffset, search = '') => fetch(newOffset, search)

  return { rfqs, total, offset, limit, loading, error, refetch, deleteRFQ, goToPage }
}
