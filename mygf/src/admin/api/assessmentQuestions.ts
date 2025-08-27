// src/api/assessmentQuestions.ts
import { api } from './client'
import { USE_MOCK } from './env'
import * as QA from './mockAssessmentQuestions'
import type { AssessmentQuestion } from '../types/assessmentQuestion'
import { AssessmentQuestionsDB } from './mockAssessmentQuestions';

// Accept either export name
const QuestionsDB: any =
  (QA as any).AssessmentQuestionsDB ?? (QA as any).QuestionsDB ?? AssessmentQuestionsDB;

export function listAssessmentQuestions(assessmentId: string){
  if (USE_MOCK) return QuestionsDB.list(assessmentId)
  return api.get(`/assessments/${assessmentId}/questions`).then(r => r.data as AssessmentQuestion[])
}

export function createAssessmentQuestion(
  payload: Omit<AssessmentQuestion,'id'|'createdAt'|'updatedAt'> & { assessmentId: string }
){
  if (USE_MOCK) {
    return QuestionsDB.create(payload).then((rec: any) => {
      return rec
    })
  }
  return api.post(`/assessments/${payload.assessmentId}/questions`, payload).then(r => r.data as AssessmentQuestion)
}

export function updateAssessmentQuestion(id: string, patch: Partial<AssessmentQuestion>){
  if (USE_MOCK) {
    return QuestionsDB.update(id, patch).then((rec: any) => {
      return rec
    })
  }
  return api.patch(`/questions/${id}`, patch).then(r => r.data as AssessmentQuestion)
}

export function deleteAssessmentQuestion(id: string){
  if (USE_MOCK) {
    return QuestionsDB.delete(id).then((res: any) => {
      return res
    })
  }
  return api.delete(`/questions/${id}`).then(r => r.data as any)
}

export function reorderAssessmentQuestions(assessmentId: string, orderedIds: string[]) {
  if (USE_MOCK) {
    return QuestionsDB.reorder(assessmentId, orderedIds).then((list: any) => {
      return list
    })
  }
  return api.post(`/assessments/${assessmentId}/questions/reorder`, { ids: orderedIds }).then(r => r.data as AssessmentQuestion[])
}

export function attachQuestionFile(id: string, file:{ id:string; name:string; mime:string; size:number; dataUrl:string }) {
  if (USE_MOCK) {
    return QuestionsDB.attachFile(id, file).then((rec: any) => {
      return rec
    })
  }
  return api.post(`/questions/${id}/attachments`, file).then(r => r.data)
}
export function removeQuestionAttachment(id: string, attId: string) {
  if (USE_MOCK) {
    return QuestionsDB.removeAttachment(id, attId).then((rec: any) => {
      return rec
    })
  }
  return api.delete(`/questions/${id}/attachments/${attId}`).then(r => r.data)
}
