"use client";

/**
 * EditorRouter — dispatch ke editor component sesuai column.meta.editor.
 *
 * Phase 2: TEXT, NUMBER, FLOAT, DATE, TIMESTAMP, BOOL.
 * Phase 3: CHOICE, CHOICE_CASCADE, REFERENCE, MULTI_SELECT.
 * Phase 5: FILE.
 *
 * Editor component contract:
 *   - value: current cell value (resolved via overlay)
 *   - onCommit: dipanggil saat user confirm (Enter / blur)
 *   - onCancel: dipanggil saat user batal (Esc)
 *   - autoFocus: true saat mount (cell baru di-active-kan)
 */

import { TextEditor } from "./TextEditor";
import { NumberEditor } from "./NumberEditor";
import { DateEditor } from "./DateEditor";
import { BoolEditor } from "./BoolEditor";
import { ChoiceEditor } from "./ChoiceEditor";
import { ChoiceCascadeEditor } from "./ChoiceCascadeEditor";
import { ReferenceEditor } from "./ReferenceEditor";
import { MultiSelectEditor } from "./MultiSelectEditor";
import { FileEditor } from "./FileEditor";
import type { CellEditorProps } from "./types";

export function EditorRouter(props: CellEditorProps) {
    const { editor } = props;
    switch (editor) {
        case "TEXT":
        case "RICH_TEXT":
        case "URL":
            return <TextEditor {...props} />;
        case "NUMBER":
            return <NumberEditor {...props} integer />;
        case "FLOAT":
            return <NumberEditor {...props} />;
        case "DATE":
            return <DateEditor {...props} />;
        case "TIMESTAMP":
            return <DateEditor {...props} timestamp />;
        case "BOOL":
            return <BoolEditor {...props} />;
        case "CHOICE":
            return <ChoiceEditor {...props} />;
        case "CHOICE_CASCADE":
            return <ChoiceCascadeEditor {...props} />;
        case "REFERENCE":
            return <ReferenceEditor {...props} />;
        case "MULTI_SELECT":
            return <MultiSelectEditor {...props} />;
        case "FILE":
            return <FileEditor {...props} />;
        default:
            return <TextEditor {...props} />;
    }
}
