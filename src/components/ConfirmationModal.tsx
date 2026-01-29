import { useState, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export type ConfirmationLevel = 'normal' | 'critical'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  level?: ConfirmationLevel
  /** For critical actions: checkbox text that must be checked before confirming */
  checkboxText?: string
  /** For critical actions: text that must be typed to confirm (e.g., "RADERA") */
  typeToConfirm?: string
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Bekräfta',
  cancelText = 'Avbryt',
  level = 'normal',
  checkboxText,
  typeToConfirm,
}: ConfirmationModalProps) {
  const [isChecked, setIsChecked] = useState(false)
  const [typedText, setTypedText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsChecked(false)
      setTypedText('')
      setIsLoading(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const isCritical = level === 'critical'
  const needsCheckbox = isCritical && checkboxText
  const needsTypeConfirm = isCritical && typeToConfirm

  // Determine if confirm button should be enabled
  const isConfirmEnabled = 
    (!needsCheckbox || isChecked) && 
    (!needsTypeConfirm || typedText.toUpperCase() === typeToConfirm?.toUpperCase())

  const handleConfirm = async () => {
    if (!isConfirmEnabled || isLoading) return
    
    setIsLoading(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Confirmation action failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isCritical ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            {isCritical && (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            )}
            <h2 className={`text-lg font-semibold ${isCritical ? 'text-red-900' : 'text-gray-900'}`}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Warning banner for critical actions */}
          {isCritical && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <strong>Varning!</strong> Denna åtgärd kan inte ångras.
                </div>
              </div>
            </div>
          )}

          {/* Message */}
          <p className="text-gray-700">{message}</p>

          {/* Checkbox confirmation */}
          {needsCheckbox && (
            <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">{checkboxText}</span>
            </label>
          )}

          {/* Type to confirm */}
          {needsTypeConfirm && (
            <div className="space-y-2">
              <label className="block text-sm text-gray-700">
                Skriv <strong className="text-red-600 font-mono">{typeToConfirm}</strong> för att bekräfta:
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={typeToConfirm}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
                autoComplete="off"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isLoading}
            className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isCritical
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Vänta...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
