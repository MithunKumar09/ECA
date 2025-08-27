import { api } from './client'
import { USE_MOCK } from './env'
import { AssignmentsDB } from './mockAssignments'
import type { Assignment, AssignmentFilters, AssignmentStatus } from '../types/assignment'

export function listAssignments(filters: AssignmentFilters){
  if (USE_MOCK) return AssignmentsDB.list(filters)
  return api.get('/assignments', { params: filters }).then(r => r.data as Assignment[])
}

export function createAssignment(payload: Omit<Assignment,'id'|'createdAt'|'updatedAt'>){
  if (USE_MOCK) {
    return AssignmentsDB.create(payload).then(rec => {
      return rec
    })
  }
  return api.post('/assignments', payload).then(r => r.data as Assignment)
}

export function updateAssignment(id: string, patch: Partial<Assignment>){
  if (USE_MOCK) {
    return AssignmentsDB.update(id, patch).then(rec => {
      return rec
    })
  }
  return api.patch(`/assignments/${id}`, patch).then(r => r.data as Assignment)
}

export function deleteAssignment(id: string){
  if (USE_MOCK) {
    return AssignmentsDB.delete(id).then(res => {
      return res
    })
  }
  return api.delete(`/assignments/${id}`).then(r => r.data as any)
}

export function setAssignmentStatus(id: string, status: AssignmentStatus){
  if (USE_MOCK) {
    return AssignmentsDB.setStatus(id, status).then(rec => {
      return rec
    })
  }
  return api.post(`/assignments/${id}/status`, { status }).then(r => r.data as Assignment)
}
