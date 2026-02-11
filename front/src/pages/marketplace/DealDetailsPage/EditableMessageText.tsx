import {useCallback, useEffect, useRef, useState} from 'react';
import cn from 'classnames';

import {BlockNew, Button, Icon, ListItem, Spinner, Text} from '@components';

import styles from './EditableMessageText.module.scss';

interface EditableMessageTextProps {
  isPending: boolean
  value: string
  onSave: (text: string) => void | Promise<void>
  canEdit?: boolean
  placeholder?: string
}

export function EditableMessageText({
  value,
  onSave,
  isPending,
  canEdit = true,
  placeholder = 'Post message text...',
}: EditableMessageTextProps) {
  const [editing, setEditing] = useState(false);
  const [localText, setLocalText] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [localText, editing]);

  const startEditing = useCallback(() => {
    setLocalText(value);
    setEditing(true);
  }, [value]);

  const onCancel = useCallback(() => {
    setLocalText(value);
    setEditing(false);
  }, [value]);

  const onDone = useCallback(async () => {
    const trimmed = localText.trim();
    if (!trimmed) {
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [localText, onSave]);

  return (
    <ListItem
      text={
        editing ? (
          <textarea
            ref={textareaRef}
            className={cn(styles.editRoot, styles.textarea)}
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            placeholder={placeholder}
            autoFocus
            autoComplete="off"
          />
        ) : (
          <Text type="text">
            {value}
          </Text>
        )
      }
      after={
        isPending ? (
          <Spinner size={8} />
        ) : editing ? (
          <BlockNew justify="start" gap={4}>
            <Button size="xs" type="basic" onClick={onCancel} disabled={saving}>
              <Icon name="cross" size={16} color="danger"/>
            </Button>
            <Button
              size="xs"
              type="primary"
              onClick={onDone}
              prefix={
                <Icon name="checkmark" size={16} color="primary"/>
              }
              disabled={saving || !localText.trim()}
            >
            </Button>
          </BlockNew>
        ) : canEdit ? (
          <Button size="small" onClick={startEditing}>
            Edit
          </Button>
        ) : undefined
      }
    />
  )
}
