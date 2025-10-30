import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ImageBackground,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { authService } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Responsive sizing
const responsiveSize = (size) => Math.round((width / 375) * size);
const responsiveHeight = (size) => Math.round((height / 812) * size);

const LoginScreen = ({ navigation, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [success, setSuccess] = useState('');
  const [isCheckingUser, setIsCheckingUser] = useState(true);

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      setIsCheckingUser(true);
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        setError(`You are currently logged in as ${user.full_name}. Please log out first or enter your password to continue.`);
      }
    } catch (error) {
      console.error('Error checking user status:', error);
    } finally {
      setIsCheckingUser(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setSuccess('');
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      const user = await authService.loginUser(username, password);
      
      // Store user data
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setCurrentUser(user);
      
      setSuccess('Login successful!');
      
      // Call the parent's login handler
      setTimeout(() => {
        onLogin?.(user);
      }, 1000);

    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReauthenticate = async () => {
    if (!currentUser || !password) {
      setError('Please enter your password to continue');
      return;
    }

    setLoading(true);
    try {
      // Use currentUser.username instead of currentUser.username
      const user = await authService.loginUser(currentUser.username, password);
      setSuccess('Authentication successful!');
      
      setTimeout(() => {
        onLogin?.(user);
      }, 1000);

    } catch (err) {
      setError('Invalid password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['user', 'userRole']);
      setCurrentUser(null);
      setUsername('');
      setPassword('');
      setError('');
      setSuccess('Logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
      setError('Error during logout');
    }
  };

  if (isCheckingUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ImageBackground 
          source={require('../assets/origbg1.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Checking authentication...</Text>
          </View>
        </ImageBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ImageBackground 
        source={require('../assets/origbg1.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.loginCard}>
              <View style={styles.cardHeader}>
                <Image 
                  source={require('../assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.cardTitle}>
                  {currentUser ? 'Welcome Back' : 'Thesis Guard Login'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {currentUser 
                    ? `Continue as ${currentUser.full_name}`
                    : 'Access your thesis repository account'
                  }
                </Text>
              </View>

              <View style={styles.form}>
                {error ? (
                  <View style={[
                    styles.errorContainer,
                    currentUser && styles.warningContainer
                  ]}>
                    <Icon 
                      name={currentUser ? "alert-circle" : "alert-octagon"} 
                      size={responsiveSize(20)} 
                      color={currentUser ? "#D97706" : "#DC2626"} 
                      style={styles.errorIcon}
                    />
                    <Text style={[
                      styles.errorText,
                      currentUser && styles.warningText
                    ]}>
                      {error}
                    </Text>
                  </View>
                ) : null}

                {success ? (
                  <View style={styles.successContainer}>
                    <Icon name="check-circle" size={responsiveSize(20)} color="#166534" style={styles.successIcon} />
                    <Text style={styles.successText}>{success}</Text>
                  </View>
                ) : null}

                {!currentUser && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Username</Text>
                    <View style={styles.inputWrapper}>
                      <Icon name="account" size={responsiveSize(20)} color="#9CA3AF" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your username"
                        placeholderTextColor="#9CA3AF"
                        value={username}
                        onChangeText={setUsername}
                        editable={!loading}
                        autoCapitalize="none"
                        autoComplete="username"
                      />
                    </View>
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>
                    {currentUser ? 'Enter Password to Continue' : 'Password'}
                  </Text>
                  <View style={styles.inputWrapper}>
                    <Icon name="lock" size={responsiveSize(20)} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your password"
                      placeholderTextColor="#9CA3AF"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      autoComplete="password"
                      onSubmitEditing={currentUser ? handleReauthenticate : handleLogin}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                    >
                      <Icon 
                        name={showPassword ? "eye-off" : "eye"} 
                        size={responsiveSize(20)} 
                        color="#9CA3AF" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {currentUser ? (
                  <View style={styles.authButtonsContainer}>
                    <TouchableOpacity
                      style={[styles.continueButton, loading && styles.buttonDisabled]}
                      onPress={handleReauthenticate}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Icon name="lock-open" size={responsiveSize(20)} color="#FFFFFF" />
                      )}
                      <Text style={styles.continueButtonText}>
                        {loading ? 'Verifying...' : 'Continue with Password'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.logoutButton}
                      onPress={handleLogout}
                      disabled={loading}
                    >
                      <Icon name="logout" size={responsiveSize(20)} color="#6B7280" />
                      <Text style={styles.logoutButtonText}>Logout</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <TouchableOpacity
                      style={[styles.loginButton, loading && styles.buttonDisabled]}
                      onPress={handleLogin}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Icon name="login" size={responsiveSize(20)} color="#FFFFFF" />
                      )}
                      <Text style={styles.loginButtonText}>
                        {loading ? 'Signing In...' : 'Sign In'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.linkContainer}>
                      <Text style={styles.linkText}>
                        Don't have an account?{' '}
                      </Text>
                      <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                        <Text style={styles.link}>Create account</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: responsiveSize(20),
    paddingVertical: responsiveSize(16),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: responsiveSize(16),
    marginTop: responsiveSize(16),
  },
  loginCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: responsiveSize(16),
    padding: responsiveSize(24),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 10,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: responsiveSize(24),
  },
  logoImage: {
    width: responsiveSize(80),
    height: responsiveSize(80),
    marginBottom: responsiveSize(16),
  },
  cardTitle: {
    fontSize: responsiveSize(24),
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: responsiveSize(8),
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: responsiveSize(14),
    color: '#6B7280',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: responsiveSize(8),
    padding: responsiveSize(16),
    marginBottom: responsiveSize(16),
  },
  warningContainer: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  errorIcon: {
    marginRight: responsiveSize(8),
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: responsiveSize(14),
  },
  warningText: {
    color: '#D97706',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: responsiveSize(8),
    padding: responsiveSize(16),
    marginBottom: responsiveSize(16),
  },
  successIcon: {
    marginRight: responsiveSize(8),
  },
  successText: {
    flex: 1,
    color: '#166534',
    fontSize: responsiveSize(14),
  },
  inputContainer: {
    marginBottom: responsiveSize(16),
  },
  label: {
    fontSize: responsiveSize(14),
    fontWeight: '600',
    color: '#374151',
    marginBottom: responsiveSize(8),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: responsiveSize(12),
    zIndex: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: responsiveSize(8),
    padding: responsiveSize(12),
    paddingLeft: responsiveSize(40),
    fontSize: responsiveSize(16),
    backgroundColor: '#FFFFFF',
  },
  eyeButton: {
    position: 'absolute',
    right: responsiveSize(12),
    padding: responsiveSize(4),
  },
  authButtonsContainer: {
    gap: responsiveSize(12),
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: responsiveSize(8),
    padding: responsiveSize(16),
    marginTop: responsiveSize(8),
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: responsiveSize(8),
    padding: responsiveSize(12),
    marginTop: responsiveSize(8),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveSize(16),
    fontWeight: '600',
    marginLeft: responsiveSize(8),
  },
  logoutButtonText: {
    color: '#6B7280',
    fontSize: responsiveSize(14),
    fontWeight: '600',
    marginLeft: responsiveSize(8),
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: responsiveSize(8),
    padding: responsiveSize(16),
    marginTop: responsiveSize(8),
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveSize(16),
    fontWeight: '600',
    marginLeft: responsiveSize(8),
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: responsiveSize(20),
  },
  linkText: {
    color: '#6B7280',
    fontSize: responsiveSize(14),
  },
  link: {
    color: '#DC2626',
    fontSize: responsiveSize(14),
    fontWeight: '600',
  },
});

export default LoginScreen;