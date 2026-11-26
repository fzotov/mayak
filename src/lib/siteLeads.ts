import { supabase } from './supabase'
import type { Tables } from './database.types'

/**
 * Заявки с сайта. Основное хранилище — таблица site_leads.
 * Пока её нет, сайт складывает обращения задачами («Заявка с сайта: …»),
 * и мы показываем их в том же виде, чтобы ничего не терялось.
 */
export type SiteLead = Tables<'site_leads'>

const field = (text: string, label: string) =>
  text.match(new RegExp(`${label}: (.+)`))?.[1]?.trim() || null

function taskToLead(task: Pick<Tables<'tasks'>, 'id' | 'title' | 'description' | 'created_at' | 'status'>): SiteLead {
  const text = task.description || ''
  return {
    id: task.id,
    created_at: task.created_at || '',
    name: field(text, 'Имя'),
    phone: field(text, 'Телефон') || task.title.replace('Заявка с сайта: ', ''),
    email: null,
    message: field(text, 'Детали'),
    unit_number: field(text, 'Помещение'),
    area_wanted: null,
    source: field(text, 'Источник'),
    page_url: field(text, 'Страница'),
    status: task.status === 'done' ? 'done' : task.status === 'in_progress' ? 'in_work' : 'new',
  }
}

export async function fetchSiteLeads(limit = 300): Promise<{ leads: SiteLead[]; fallback: boolean }> {
  const { data, error } = await supabase
    .from('site_leads').select('*').order('created_at', { ascending: false }).limit(limit)
  if (!error) return { leads: data || [], fallback: false }

  const { data: tasks } = await supabase
    .from('tasks').select('id,title,description,created_at,status')
    .like('title', 'Заявка с сайта%')
    .order('created_at', { ascending: false }).limit(limit)
  return { leads: (tasks || []).map(taskToLead), fallback: true }
}

export async function updateLeadStatus(id: string, status: string, fallback: boolean) {
  const taskStatus = status === 'done' ? 'done' : status === 'in_work' ? 'in_progress' : 'todo'
  const { error } = fallback
    ? await supabase.from('tasks').update({ status: taskStatus }).eq('id', id)
    : await supabase.from('site_leads').update({ status }).eq('id', id)
  if (error) throw new Error('Статус заявки не сохранён: ' + error.message)
}
