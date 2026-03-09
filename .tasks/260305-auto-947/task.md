# Task

## Issue Title

Math Expressions Rendering as Code Blocks
# 🐞 Bug Report

## 1. Title
Math Expressions Rendering as Code Blocks

## 2. Environment
- Environment: dev

## 3. Preconditions
Preconditions

The user is logged into the chat application.

The chat session is active and responsive.


## 4. Steps to Reproduce
Open the chat interface.

Trigger the generation of complex math expressions by asking the chat for examples of "סדר פעולות חשבון" (Order of Operations) in the context of a 7th-grade class.

Input or receive a math expression containing a fraction and brackets, for example: [ 2 \cdot (1 \frac{2}{13} + 1).

View the message in the chat history to see if the LaTeX renders correctly or fails into a code block.

## 5. Expected Result


The expression should be rendered as a formatted math equation (e.g., using a vertical fraction bar and proper mathematical symbols).

## 6. Actual Result
The chat interface intermittently fails to render LaTeX math expressions, displaying them as raw text in a code-like block instead of formatted mathematical notation. This seems specifically triggered by more complex syntax like fractions.

The expression appears as raw LaTeX code inside a grey background/code block: [ 2 \cdot (1 \frac{2}{13} + 1).



The problematic string being sent is:

[ 2 \cdot (1 \frac{2}{13} + 1)


## 7. Reproducibility
always
