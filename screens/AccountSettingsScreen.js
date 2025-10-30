import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  ImageBackground,
  Animated,
  Image,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

const { width, height } = Dimensions.get('window');

// Responsive sizing
const responsiveSize = (size) => Math.round((width / 375) * size);
const responsiveHeight = (size) => Math.round((height / 812) * size);

const AccountSettingsScreen = ({ navigation, onLogout }) => {
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    birthdate: '',
    year_level: '',
    college_department: '',
    course: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-300));
  const [userRole, setUserRole] = useState('student');
  const [studentInfo, setStudentInfo] = useState(null);

  useEffect(() => {
    fetchUserData();
    checkUserRole();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        Alert.alert('Error', 'Please log in to access account settings');
        navigation.navigate('Login');
        return;
      }

      const currentUser = JSON.parse(userData);
      setUser(currentUser);

      // Fetch user details
      const { data: userDataFromDb, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', currentUser.user_id)
        .single();

      if (error) {
        console.error('Error fetching user data:', error);
        throw error;
      }

      if (!userDataFromDb) {
        Alert.alert('Error', 'User not found');
        navigation.navigate('Login');
        return;
      }

      setUserDetails(userDataFromDb);

      // Get student info if user is a student
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', currentUser.user_id)
        .single();

      if (studentError && studentError.code !== 'PGRST116') {
        console.error('Error fetching student data:', studentError);
      }

      if (studentData) {
        setStudentInfo(studentData);
        setFormData({
          username: userDataFromDb.username || '',
          full_name: userDataFromDb.full_name || '',
          email: userDataFromDb.email || '',
          phone: userDataFromDb.phone || '',
          birthdate: userDataFromDb.birthdate || '',
          year_level: studentData.year_level || '',
          college_department: studentData.college_department || '',
          course: studentData.course || ''
        });
      } else {
        setFormData({
          username: userDataFromDb.username || '',
          full_name: userDataFromDb.full_name || '',
          email: userDataFromDb.email || '',
          phone: userDataFromDb.phone || '',
          birthdate: userDataFromDb.birthdate || '',
          year_level: '',
          college_department: '',
          course: ''
        });
      }

    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const checkUserRole = async () => {
    try {
      const role = await AsyncStorage.getItem('userRole');
      if (role) {
        setUserRole(role);
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const checkUsernameAvailability = async (username) => {
    if (!username || username === userDetails?.username) {
      setUsernameAvailable(true);
      return;
    }

    setCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .neq('user_id', user?.user_id)
        .single();

      setUsernameAvailable(!data);
    } catch (error) {
      setUsernameAvailable(true);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });

    if (field === 'username') {
      checkUsernameAvailability(value);
    }
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData({
      ...passwordData,
      [field]: value
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    if (!formData.username.trim()) {
      setError('Username is required');
      setSaving(false);
      return;
    }

    if (!formData.full_name.trim()) {
      setError('Full name is required');
      setSaving(false);
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      setSaving(false);
      return;
    }

    if (!usernameAvailable) {
      setError('Username is already taken. Please choose a different one.');
      setSaving(false);
      return;
    }

    try {
      // Update user table
      const { data: updatedUser, error: userError } = await supabase
        .from('users')
        .update({
          username: formData.username,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          birthdate: formData.birthdate || null,
        })
        .eq('user_id', user.user_id)
        .select();

      if (userError) throw userError;

      // Update AsyncStorage
      const updatedUserData = {
        ...user,
        username: formData.username,
        full_name: formData.full_name,
        email: formData.email
      };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUserData));
      setUser(updatedUserData);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

    } catch (error) {
      console.error('Error updating user:', error);
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setError('');

    if (!passwordData.currentPassword) {
      setError('Current password is required');
      return;
    }

    if (!passwordData.newPassword) {
      setError('New password is required');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    try {
      // Verify current password
      const { data: userData, error: verifyError } = await supabase
        .from('users')
        .select('password')
        .eq('user_id', user.user_id)
        .single();

      if (verifyError) throw verifyError;

      if (userData.password !== passwordData.currentPassword) {
        setError('Current password is incorrect');
        return;
      }

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password: passwordData.newPassword,
        })
        .eq('user_id', user.user_id);

      if (updateError) throw updateError;

      setPasswordSaved(true);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordForm(false);

      setTimeout(() => setPasswordSaved(false), 3000);

    } catch (error) {
      console.error('Error updating password:', error);
      setError('Failed to update password. Please try again.');
    }
  };

  const toggleMenu = () => {
    if (isMenuVisible) {
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setIsMenuVisible(false));
    } else {
      setIsMenuVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('userRole');
      
      if (onLogout) {
        onLogout();
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleNavigation = (screen) => {
    toggleMenu();
    navigation.navigate(screen);
  };

  if (loading) {
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
            <Text style={styles.loadingText}>Loading your profile...</Text>
          </View>
        </ImageBackground>
      </SafeAreaView>
    );
  }

  const displayName = userDetails?.full_name || user?.full_name || 'User';
  const displayCollege = studentInfo?.college_department || 'No college specified';
  const displayCourse = studentInfo?.course || 'No course specified';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ImageBackground 
        source={require('../assets/origbg1.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Responsive Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
            <Icon name="menu" size={responsiveSize(24)} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/logo-small.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Account Settings</Text>
          </View>
          
          <View style={styles.headerSpacer} />
        </View>

        {/* Mobile Navigation Menu Modal */}
        <Modal
          visible={isMenuVisible}
          transparent={true}
          animationType="none"
          onRequestClose={toggleMenu}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={toggleMenu}
          >
            <Animated.View 
              style={[
                styles.mobileMenu,
                {
                  transform: [{ translateX: slideAnim }]
                }
              ]}
            >
              <View style={styles.menuHeader}>
                <Image 
                  source={require('../assets/logo-small.png')} 
                  style={styles.menuLogo}
                  resizeMode="contain"
                />
                <Text style={styles.menuTitle}>Thesis Guard</Text>
                <TouchableOpacity onPress={toggleMenu} style={styles.closeButton}>
                  <Icon name="close" size={responsiveSize(24)} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* User Info in Side Navigation */}
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{displayName}</Text>
                <Text style={styles.userRole}>{userRole === 'admin' ? 'Administrator' : 'Student'}</Text>
                {studentInfo && (
                  <>
                    <Text style={styles.userDetail}>Department: {displayCollege}</Text>
                    <Text style={styles.userDetail}>Course: {displayCourse}</Text>
                  </>
                )}
              </View>

              <View style={styles.menuItems}>
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => handleNavigation('Home')}
                >
                  <Icon name="home" size={responsiveSize(20)} color="#333" />
                  <Text style={styles.menuItemText}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => handleNavigation('Profile')}
                >
                  <Icon name="account" size={responsiveSize(20)} color="#333" />
                  <Text style={styles.menuItemText}>Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.menuItem, styles.activeMenuItem]}
                  onPress={() => handleNavigation('AccountSettings')}
                >
                  <Icon name="cog" size={responsiveSize(20)} color="#dc3545" />
                  <Text style={[styles.menuItemText, styles.activeMenuItemText]}>Account Settings</Text>
                </TouchableOpacity>

                {userRole === 'admin' && (
                  <TouchableOpacity 
                    style={styles.menuItem}
                    onPress={() => handleNavigation('AdminDashboard')}
                  >
                    <Icon name="shield-account" size={responsiveSize(20)} color="#333" />
                    <Text style={styles.menuItemText}>Admin Dashboard</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={[styles.menuItem, styles.logoutButton]}
                  onPress={handleLogout}
                >
                  <Icon name="logout" size={responsiveSize(20)} color="#FFFFFF" />
                  <Text style={[styles.menuItemText, styles.logoutText]}>Log out</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Modal>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {error ? (
            <View style={styles.errorContainer}>
              <Icon name="alert-octagon" size={responsiveSize(20)} color="#DC2626" style={styles.errorIcon} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {saved && (
            <View style={styles.successContainer}>
              <Icon name="check-circle" size={responsiveSize(20)} color="#166534" style={styles.successIcon} />
              <Text style={styles.successText}>✓ Profile updated successfully!</Text>
            </View>
          )}

          {passwordSaved && (
            <View style={styles.successContainer}>
              <Icon name="check-circle" size={responsiveSize(20)} color="#166534" style={styles.successIcon} />
              <Text style={styles.successText}>✓ Password updated successfully!</Text>
            </View>
          )}

          {/* Personal Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="account" size={responsiveSize(20)} color="#dc3545" />
              <Text style={styles.sectionTitle}>Personal Information</Text>
            </View>
            
            <View style={styles.formGrid}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Username *</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="account" size={responsiveSize(20)} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      !usernameAvailable && formData.username !== userDetails?.username && styles.inputError
                    ]}
                    value={formData.username}
                    onChangeText={(value) => handleInputChange('username', value)}
                    placeholder="Choose a username"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                {checkingUsername && (
                  <Text style={styles.helperText}>Checking username availability...</Text>
                )}
                {!usernameAvailable && formData.username !== userDetails?.username && (
                  <Text style={styles.errorHelperText}>Username is already taken</Text>
                )}
                {usernameAvailable && formData.username && formData.username !== userDetails?.username && (
                  <Text style={styles.successHelperText}>Username is available</Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.full_name}
                  onChangeText={(value) => handleInputChange('full_name', value)}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email Address *</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="email" size={responsiveSize(20)} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                    placeholder="your.email@example.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="phone" size={responsiveSize(20)} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.phone}
                    onChangeText={(value) => handleInputChange('phone', value)}
                    placeholder="+63 912 345 6789"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Birthdate</Text>
                <TextInput
                  style={styles.input}
                  value={formData.birthdate}
                  onChangeText={(value) => handleInputChange('birthdate', value)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {studentInfo && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Student ID</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={studentInfo.student_id?.toString() || ''}
                    editable={false}
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.helperText}>Student ID cannot be changed</Text>
                </View>
              )}
            </View>
          </View>

          {/* Academic Information - Only for Students */}
          {studentInfo && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="book-open" size={responsiveSize(20)} color="#dc3545" />
                <Text style={styles.sectionTitle}>Academic Information</Text>
                <Text style={styles.sectionSubtitle}>(Contact your administrator to update academic information)</Text>
              </View>
              
              <View style={styles.formGrid}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Year Level</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={formData.year_level}
                    editable={false}
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.helperText}>Year level cannot be changed here</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>College Department</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={formData.college_department}
                    editable={false}
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.helperText}>College department cannot be changed here</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Course/Program</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={formData.course}
                    editable={false}
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.helperText}>Course cannot be changed here</Text>
                </View>
              </View>
            </View>
          )}

          {/* Security */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="shield-account" size={responsiveSize(20)} color="#dc3545" />
              <Text style={styles.sectionTitle}>Security</Text>
            </View>
            
            <View style={styles.securityContainer}>
              <TouchableOpacity 
                style={styles.changePasswordButton}
                onPress={() => setShowPasswordForm(!showPasswordForm)}
              >
                <Text style={styles.changePasswordText}>Change Password</Text>
              </TouchableOpacity>

              {showPasswordForm && (
                <View style={styles.passwordForm}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Current Password</Text>
                    <View style={styles.inputWrapper}>
                      <Icon name="lock" size={responsiveSize(20)} color="#9CA3AF" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={passwordData.currentPassword}
                        onChangeText={(value) => handlePasswordChange('currentPassword', value)}
                        placeholder="Enter current password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showCurrentPassword}
                      />
                      <TouchableOpacity
                        onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                        style={styles.eyeButton}
                      >
                        <Icon 
                          name={showCurrentPassword ? "eye-off" : "eye"} 
                          size={responsiveSize(20)} 
                          color="#9CA3AF" 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.inputWrapper}>
                      <Icon name="lock" size={responsiveSize(20)} color="#9CA3AF" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={passwordData.newPassword}
                        onChangeText={(value) => handlePasswordChange('newPassword', value)}
                        placeholder="Enter new password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showNewPassword}
                      />
                      <TouchableOpacity
                        onPress={() => setShowNewPassword(!showNewPassword)}
                        style={styles.eyeButton}
                      >
                        <Icon 
                          name={showNewPassword ? "eye-off" : "eye"} 
                          size={responsiveSize(20)} 
                          color="#9CA3AF" 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <View style={styles.inputWrapper}>
                      <Icon name="lock-check" size={responsiveSize(20)} color="#9CA3AF" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={passwordData.confirmPassword}
                        onChangeText={(value) => handlePasswordChange('confirmPassword', value)}
                        placeholder="Confirm new password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showConfirmPassword}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeButton}
                      >
                        <Icon 
                          name={showConfirmPassword ? "eye-off" : "eye"} 
                          size={responsiveSize(20)} 
                          color="#9CA3AF" 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.passwordActions}>
                    <TouchableOpacity 
                      style={styles.updatePasswordButton}
                      onPress={handlePasswordUpdate}
                    >
                      <Text style={styles.updatePasswordText}>Update Password</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.cancelPasswordButton}
                      onPress={() => setShowPasswordForm(false)}
                    >
                      <Text style={styles.cancelPasswordText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.accountInfo}>
                <Text style={styles.accountInfoText}>
                  Account created: {userDetails?.created_at ? new Date(userDetails.created_at).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, (saving || !usernameAvailable || checkingUsername) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving || !usernameAvailable || checkingUsername}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Icon name="content-save" size={responsiveSize(20)} color="#FFFFFF" />
            )}
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: responsiveHeight(60),
    backgroundColor: '#dc3545',
    paddingHorizontal: responsiveSize(16),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuButton: {
    padding: responsiveSize(4),
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: responsiveSize(30),
    height: responsiveSize(30),
    marginRight: responsiveSize(10),
  },
  headerTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: responsiveSize(40),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mobileMenu: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: responsiveSize(280),
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSize(20),
    paddingVertical: responsiveSize(16),
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#dc3545',
  },
  menuLogo: {
    width: responsiveSize(25),
    height: responsiveSize(25),
    marginRight: responsiveSize(10),
  },
  menuTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: responsiveSize(4),
  },
  menuItems: {
    paddingVertical: responsiveSize(10),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: responsiveSize(12),
    paddingHorizontal: responsiveSize(20),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activeMenuItem: {
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#dc3545',
  },
  menuItemText: {
    fontSize: responsiveSize(16),
    color: '#333',
    marginLeft: responsiveSize(10),
  },
  activeMenuItemText: {
    color: '#dc3545',
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: responsiveSize(20),
    backgroundColor: '#dc3545',
    borderRadius: responsiveSize(8),
    marginHorizontal: responsiveSize(20),
    justifyContent: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: responsiveSize(16),
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: responsiveSize(16),
    marginTop: responsiveSize(16),
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 242, 242, 0.9)',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: responsiveSize(8),
    padding: responsiveSize(16),
    marginBottom: responsiveSize(16),
  },
  errorIcon: {
    marginRight: responsiveSize(8),
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: responsiveSize(14),
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 253, 244, 0.9)',
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
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: responsiveSize(12),
    padding: responsiveSize(16),
    marginBottom: responsiveSize(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderLeftWidth: responsiveSize(4),
    borderLeftColor: '#dc3545',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSize(16),
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: responsiveSize(16),
    fontWeight: 'bold',
    color: '#333',
    marginLeft: responsiveSize(8),
  },
  sectionSubtitle: {
    fontSize: responsiveSize(12),
    color: '#666',
    marginLeft: responsiveSize(8),
    marginTop: responsiveSize(4),
    fontStyle: 'italic',
    width: '100%',
  },
  formGrid: {
    gap: responsiveSize(12),
  },
  inputContainer: {
    marginBottom: responsiveSize(8),
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
    color: '#374151',
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
    borderColor: '#E5E7EB',
  },
  eyeButton: {
    position: 'absolute',
    right: responsiveSize(12),
    padding: responsiveSize(4),
  },
  helperText: {
    fontSize: responsiveSize(12),
    color: '#6B7280',
    marginTop: responsiveSize(4),
    fontStyle: 'italic',
  },
  errorHelperText: {
    fontSize: responsiveSize(12),
    color: '#DC2626',
    marginTop: responsiveSize(4),
  },
  successHelperText: {
    fontSize: responsiveSize(12),
    color: '#166534',
    marginTop: responsiveSize(4),
  },
  securityContainer: {
    gap: responsiveSize(16),
  },
  changePasswordButton: {
    paddingVertical: responsiveSize(12),
  },
  changePasswordText: {
    color: '#dc3545',
    fontSize: responsiveSize(16),
    fontWeight: '600',
  },
  passwordForm: {
    backgroundColor: 'rgba(248, 249, 250, 0.9)',
    borderRadius: responsiveSize(8),
    padding: responsiveSize(16),
    gap: responsiveSize(16),
  },
  passwordActions: {
    flexDirection: 'row',
    gap: responsiveSize(12),
  },
  updatePasswordButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: responsiveSize(20),
    paddingVertical: responsiveSize(12),
    borderRadius: responsiveSize(8),
    flex: 1,
  },
  updatePasswordText: {
    color: '#FFFFFF',
    fontSize: responsiveSize(14),
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelPasswordButton: {
    backgroundColor: '#6B7280',
    paddingHorizontal: responsiveSize(20),
    paddingVertical: responsiveSize(12),
    borderRadius: responsiveSize(8),
    flex: 1,
  },
  cancelPasswordText: {
    color: '#FFFFFF',
    fontSize: responsiveSize(14),
    fontWeight: '600',
    textAlign: 'center',
  },
  accountInfo: {
    paddingTop: responsiveSize(16),
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  accountInfoText: {
    fontSize: responsiveSize(14),
    color: '#6B7280',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc3545',
    borderRadius: responsiveSize(8),
    padding: responsiveSize(16),
    marginBottom: responsiveSize(20),
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveSize(16),
    fontWeight: '600',
    marginLeft: responsiveSize(8),
  },
  userInfo: {
    padding: responsiveSize(16),
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
  },
  userName: {
    fontSize: responsiveSize(16),
    fontWeight: 'bold',
    color: '#333',
  },
  userRole: {
    fontSize: responsiveSize(14),
    color: '#666',
    marginTop: responsiveSize(4),
  },
  userDetail: {
    fontSize: responsiveSize(12),
    color: '#666',
    marginTop: responsiveSize(2),
  },
});

export default AccountSettingsScreen;