import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCral(amount: number): string {
  return new Intl.NumberFormat('fr-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Montreal',
  }).format(new Date(date))
}

export function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase()
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'En attente',
    active: 'Active',
    voting: 'Vote en cours',
    resolved: 'Résolue',
    cancelled: 'Annulée',
  }
  return labels[status] ?? status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'text-yellow-400 bg-yellow-400/10',
    active: 'text-green-400 bg-green-400/10',
    voting: 'text-blue-400 bg-blue-400/10',
    resolved: 'text-gray-400 bg-gray-400/10',
    cancelled: 'text-red-400 bg-red-400/10',
  }
  return colors[status] ?? 'text-gray-400 bg-gray-400/10'
}
