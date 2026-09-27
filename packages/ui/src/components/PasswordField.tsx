import { useState } from 'react';
import { Pressable } from 'react-native';
import { AppIcon } from '../icons';
import { TextField, type TextFieldProps } from './TextField';

export type PasswordFieldProps = Omit<TextFieldProps, 'secureTextEntry'>;

/** Password input with show/hide eye toggle. Used by login + register in all apps. */
export function PasswordField({ label = 'Password', ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      label={label}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      rightAccessory={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
        >
          <AppIcon name={visible ? 'eye' : 'eyeOff'} size={22} weight="duotone" />
        </Pressable>
      }
      {...props}
    />
  );
}
