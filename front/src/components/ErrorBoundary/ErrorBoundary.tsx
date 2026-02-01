import React, { Component, type ReactNode } from 'react'
import { PageLayout, Text, Button, BlockNew } from '@components'
import styles from './ErrorBoundary.module.scss'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo,
    })

    // You can also log to an error reporting service here
    // Example: logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <PageLayout center>
          <BlockNew gap={24} className={styles.container}>
            <BlockNew gap={8}>
              <Text type="hero" weight="bold" align="center">
                Oops! Something went wrong
              </Text>
              <Text type="text" color="secondary" align="center">
                We're sorry, but something unexpected happened. Please try refreshing the page.
              </Text>
            </BlockNew>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className={styles.errorDetails}>
                <Text type="caption" color="secondary">
                  Error: {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <details className={styles.stackTrace}>
                    <summary>Stack Trace</summary>
                    <pre>{this.state.errorInfo.componentStack}</pre>
                  </details>
                )}
              </div>
            )}

            <BlockNew gap={12} className={styles.actions}>
              <Button type="primary" onClick={this.handleReload}>
                Reload Page
              </Button>
              <Button type="secondary" onClick={this.handleReset}>
                Try Again
              </Button>
            </BlockNew>
          </BlockNew>
        </PageLayout>
      )
    }

    return this.props.children
  }
}
