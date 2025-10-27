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
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { authService } from '../services/authService';
import { supabase } from '../config/supabase';

const SignupScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    birthdate: '', // Added birthdate field
    student_id: '',
    year_level: '',
    college_department: '',
    course: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isStudent, setIsStudent] = useState(true);
  
  // Dropdown states
  const [collegeDepartments, setCollegeDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [showYearLevelDropdown, setShowYearLevelDropdown] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState('');

  const yearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

  useEffect(() => {
    loadCollegeDepartments();
  }, []);

  useEffect(() => {
    if (formData.college_department) {
      loadCoursesByDepartment();
    }
  }, [formData.college_department]);

  const loadCollegeDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const { data, error } = await supabase
        .from('college_departments')
        .select('department_id, department_name, department_code')
        .order('department_name');

      if (error) throw error;
      
      setCollegeDepartments(data || []);
    } catch (error) {
      console.error('Error loading college departments:', error);
      setError('Failed to load college departments');
    } finally {
      setLoadingDepartments(false);
    }
  };

  const loadCoursesByDepartment = async () => {
    if (!formData.college_department) return;
    
    try {
      setLoadingCourses(true);
      
      // First, get the department_id from the selected department name
      const department = collegeDepartments.find(
        dept => dept.department_name === formData.college_department
      );

      if (!department) return;

      const { data, error } = await supabase
        .from('courses') // Fixed table name from 'courses' to 'course'
        .select('course_id, course_name, course_code')
        .eq('department_id', department.department_id)
        .order('course_name');

      if (error) throw error;
      
      setCourses(data || []);
      // Reset course when department changes
      setFormData(prev => ({ ...prev, course: '' }));
    } catch (error) {
      console.error('Error loading courses:', error);
      setError('Failed to load courses');
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleCollegeSelect = (department) => {
    setFormData({
      ...formData,
      college_department: department.department_name,
      course: '' // Reset course when college changes
    });
    setShowCollegeDropdown(false);
  };

  const handleCourseSelect = (course) => {
    setFormData({
      ...formData,
      course: course.course_name
    });
    setShowCourseDropdown(false);
  };

  const handleYearLevelSelect = (yearLevel) => {
    setFormData({
      ...formData,
      year_level: yearLevel
    });
    setShowYearLevelDropdown(false);
  };

  // Date handling functions
  const handleDateSelect = () => {
    setTempDate(formData.birthdate);
    setShowDatePicker(true);
  };

  const handleDateConfirm = () => {
    setFormData(prev => ({ ...prev, birthdate: tempDate }));
    setShowDatePicker(false);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
  };

  const calculateAge = (birthdate) => {
    if (!birthdate) return 0;
    const today = new Date();
    const birthDate = new Date(birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const validateForm = () => {
    if (!formData.full_name.trim()) {
      setError('Please enter your full name');
      return false;
    }
    if (!formData.username.trim()) {
      setError('Please enter a username');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Please enter your email address');
      return false;
    }
    
    // Validate birthdate
    if (formData.birthdate) {
      const age = calculateAge(formData.birthdate);
      if (age < 13) {
        setError('You must be at least 13 years old to register');
        return false;
      }
      if (age > 100) {
        setError('Please enter a valid birthdate');
        return false;
      }
    }

    if (isStudent) {
      if (!formData.student_id.trim()) {
        setError('Please enter your student ID');
        return false;
      }
      if (!formData.college_department) {
        setError('Please select your college department');
        return false;
      }
      if (!formData.course.trim()) {
        setError('Please select your course/program');
        return false;
      }
      if (!formData.year_level) {
        setError('Please select your year level');
        return false;
      }
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      await authService.registerUser({
        ...formData,
        isStudent
      });
      
      setSuccess('Account created successfully! Redirecting to login...');
      
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);

    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderDropdownItem = ({ item, onSelect, isCourse = false }) => (
    <TouchableOpacity
      style={styles.dropdownItem}
      onPress={() => onSelect(item)}
    >
      <Text style={styles.dropdownItemText}>
        {isCourse ? item.course_name : item.department_name}
      </Text>
      {isCourse && item.course_code && (
        <Text style={styles.dropdownItemCode}>({item.course_code})</Text>
      )}
    </TouchableOpacity>
  );

  const renderYearLevelItem = ({ item }) => (
    <TouchableOpacity
      style={styles.dropdownItem}
      onPress={() => handleYearLevelSelect(item)}
    >
      <Text style={styles.dropdownItemText}>{item}</Text>
    </TouchableOpacity>
  );

  // Simple Date Picker Modal
  const renderDatePickerModal = () => (
    <Modal
      visible={showDatePicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowDatePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.datePickerModal}>
          <View style={styles.datePickerHeader}>
            <Text style={styles.datePickerTitle}>Select Birthdate</Text>
            <TouchableOpacity onPress={handleDateCancel}>
              <Icon name="close" size={24} color="#DC2626" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.dateInputContainer}>
            <Text style={styles.dateLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="2000-01-31"
              placeholderTextColor="#9CA3AF"
              value={tempDate}
              onChangeText={setTempDate}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.dateHint}>
              Format: YYYY-MM-DD (e.g., 2000-01-31)
            </Text>
            {tempDate && (
              <Text style={styles.ageText}>
                Age: {calculateAge(tempDate)} years old
              </Text>
            )}
          </View>

          <View style={styles.datePickerButtons}>
            <TouchableOpacity
              style={[styles.dateButton, styles.cancelButton]}
              onPress={handleDateCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateButton, styles.confirmButton]}
              onPress={handleDateConfirm}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            {/* Signup Card */}
            <View style={styles.signupCard}>
              {/* Header with Logo */}
              <View style={styles.cardHeader}>
                <Image 
                  source={require('../assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.cardTitle}>User Registration</Text>
                <Text style={styles.cardSubtitle}>
                  Create your Thesis Hub account to access research materials
                </Text>
              </View>

              {/* Signup Form */}
              <View style={styles.form}>
                {error ? (
                  <View style={styles.errorContainer}>
                    <Icon name="alert-octagon" size={20} color="#DC2626" style={styles.errorIcon} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {success ? (
                  <View style={styles.successContainer}>
                    <Icon name="check-circle" size={20} color="#166534" style={styles.successIcon} />
                    <Text style={styles.successText}>{success}</Text>
                  </View>
                ) : null}

                {/* Student Toggle */}
                <View style={styles.toggleContainer}>
                  <Text style={styles.toggleLabel}>Are you a student?</Text>
                  <TouchableOpacity
                    style={[styles.toggle, isStudent && styles.toggleActive]}
                    onPress={() => setIsStudent(!isStudent)}
                  >
                    <View style={[styles.toggleTrack, isStudent && styles.toggleTrackActive]}>
                      <View style={[styles.toggleThumb, isStudent && styles.toggleThumbActive]} />
                    </View>
                    <Text style={styles.toggleText}>
                      {isStudent ? 'Yes' : 'No'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Personal Information */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Icon name="account" size={20} color="#DC2626" />
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                  </View>
                  
                  <View style={styles.grid}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Full Name *</Text>
                      <View style={styles.inputWrapper}>
                        <Icon name="account" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Enter your full name"
                          placeholderTextColor="#9CA3AF"
                          value={formData.full_name}
                          onChangeText={(value) => handleInputChange('full_name', value)}
                        />
                      </View>
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Username *</Text>
                      <View style={styles.inputWrapper}>
                        <Icon name="account-circle" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Choose a username"
                          placeholderTextColor="#9CA3AF"
                          value={formData.username}
                          onChangeText={(value) => handleInputChange('username', value)}
                          autoCapitalize="none"
                        />
                      </View>
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Email Address *</Text>
                      <View style={styles.inputWrapper}>
                        <Icon name="email" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="your.email@cnsc.edu.ph"
                          placeholderTextColor="#9CA3AF"
                          value={formData.email}
                          onChangeText={(value) => handleInputChange('email', value)}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Phone Number</Text>
                      <View style={styles.inputWrapper}>
                        <Icon name="phone" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="+63 912 345 6789"
                          placeholderTextColor="#9CA3AF"
                          value={formData.phone}
                          onChangeText={(value) => handleInputChange('phone', value)}
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>

                    {/* Birthdate Field */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Birthdate</Text>
                      <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={handleDateSelect}
                      >
                        <View style={styles.inputWrapper}>
                          <Icon name="cake" size={20} color="#9CA3AF" style={styles.inputIcon} />
                          <Text style={[
                            styles.dropdownButtonText,
                            !formData.birthdate && styles.placeholderText
                          ]}>
                            {formData.birthdate ? formatDate(formData.birthdate) : 'Select your birthdate (Optional)'}
                          </Text>
                          <Icon 
                            name="calendar" 
                            size={20} 
                            color="#9CA3AF"
                            style={styles.dropdownArrow}
                          />
                        </View>
                      </TouchableOpacity>
                      {formData.birthdate && (
                        <Text style={styles.ageDisplay}>
                          Age: {calculateAge(formData.birthdate)} years old
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Academic Information - Only show if student */}
                {isStudent && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Icon name="book-open" size={20} color="#DC2626" />
                      <Text style={styles.sectionTitle}>Academic Information</Text>
                    </View>
                    
                    <View style={styles.grid}>
                      {/* Student ID Input */}
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Student ID *</Text>
                        <View style={styles.inputWrapper}>
                          <Icon name="card-account-details" size={20} color="#9CA3AF" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Enter your student ID"
                            placeholderTextColor="#9CA3AF"
                            value={formData.student_id}
                            onChangeText={(value) => handleInputChange('student_id', value)}
                            autoCapitalize="none"
                          />
                        </View>
                      </View>

                      {/* College Department Dropdown */}
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>College Department *</Text>
                        <TouchableOpacity
                          style={styles.dropdownButton}
                          onPress={() => setShowCollegeDropdown(true)}
                          disabled={loadingDepartments}
                        >
                          <View style={styles.inputWrapper}>
                            <Icon name="school" size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <Text style={[
                              styles.dropdownButtonText,
                              !formData.college_department && styles.placeholderText
                            ]}>
                              {formData.college_department || 'Select College Department'}
                            </Text>
                            <Icon 
                              name={loadingDepartments ? "refresh" : "chevron-down"} 
                              size={20} 
                              color="#9CA3AF"
                              style={styles.dropdownArrow}
                            />
                          </View>
                        </TouchableOpacity>

                        <Modal
                          visible={showCollegeDropdown}
                          transparent={true}
                          animationType="slide"
                          onRequestClose={() => setShowCollegeDropdown(false)}
                        >
                          <View style={styles.modalOverlay}>
                            <View style={styles.dropdownModal}>
                              <View style={styles.dropdownHeader}>
                                <Text style={styles.dropdownTitle}>Select College Department</Text>
                                <TouchableOpacity onPress={() => setShowCollegeDropdown(false)}>
                                  <Icon name="close" size={24} color="#DC2626" />
                                </TouchableOpacity>
                              </View>
                              {loadingDepartments ? (
                                <View style={styles.loadingContainer}>
                                  <ActivityIndicator size="small" color="#DC2626" />
                                  <Text style={styles.loadingText}>Loading departments...</Text>
                                </View>
                              ) : (
                                <FlatList
                                  data={collegeDepartments}
                                  keyExtractor={(item) => item.department_id.toString()}
                                  renderItem={({ item }) => renderDropdownItem({
                                    item,
                                    onSelect: handleCollegeSelect
                                  })}
                                  showsVerticalScrollIndicator={false}
                                />
                              )}
                            </View>
                          </View>
                        </Modal>
                      </View>

                      {/* Course Dropdown */}
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Course/Program *</Text>
                        <TouchableOpacity
                          style={styles.dropdownButton}
                          onPress={() => setShowCourseDropdown(true)}
                          disabled={!formData.college_department || loadingCourses}
                        >
                          <View style={styles.inputWrapper}>
                            <Icon name="book-education" size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <Text style={[
                              styles.dropdownButtonText,
                              !formData.course && styles.placeholderText
                            ]}>
                              {formData.course || 'Select Course/Program'}
                            </Text>
                            <Icon 
                              name={loadingCourses ? "refresh" : "chevron-down"} 
                              size={20} 
                              color="#9CA3AF"
                              style={styles.dropdownArrow}
                            />
                          </View>
                        </TouchableOpacity>

                        <Modal
                          visible={showCourseDropdown}
                          transparent={true}
                          animationType="slide"
                          onRequestClose={() => setShowCourseDropdown(false)}
                        >
                          <View style={styles.modalOverlay}>
                            <View style={styles.dropdownModal}>
                              <View style={styles.dropdownHeader}>
                                <Text style={styles.dropdownTitle}>Select Course/Program</Text>
                                <TouchableOpacity onPress={() => setShowCourseDropdown(false)}>
                                  <Icon name="close" size={24} color="#DC2626" />
                                </TouchableOpacity>
                              </View>
                              {loadingCourses ? (
                                <View style={styles.loadingContainer}>
                                  <ActivityIndicator size="small" color="#DC2626" />
                                  <Text style={styles.loadingText}>Loading courses...</Text>
                                </View>
                              ) : courses.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                  <Text style={styles.emptyText}>
                                    {formData.college_department 
                                      ? 'No courses available for this department'
                                      : 'Please select a college department first'
                                    }
                                  </Text>
                                </View>
                              ) : (
                                <FlatList
                                  data={courses}
                                  keyExtractor={(item) => item.course_id.toString()}
                                  renderItem={({ item }) => renderDropdownItem({
                                    item,
                                    onSelect: handleCourseSelect,
                                    isCourse: true
                                  })}
                                  showsVerticalScrollIndicator={false}
                                />
                              )}
                            </View>
                          </View>
                        </Modal>
                      </View>

                      {/* Year Level Dropdown */}
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Year Level *</Text>
                        <TouchableOpacity
                          style={styles.dropdownButton}
                          onPress={() => setShowYearLevelDropdown(true)}
                        >
                          <View style={styles.inputWrapper}>
                            <Icon name="calendar" size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <Text style={[
                              styles.dropdownButtonText,
                              !formData.year_level && styles.placeholderText
                            ]}>
                              {formData.year_level || 'Select Year Level'}
                            </Text>
                            <Icon 
                              name="chevron-down" 
                              size={20} 
                              color="#9CA3AF"
                              style={styles.dropdownArrow}
                            />
                          </View>
                        </TouchableOpacity>

                        <Modal
                          visible={showYearLevelDropdown}
                          transparent={true}
                          animationType="slide"
                          onRequestClose={() => setShowYearLevelDropdown(false)}
                        >
                          <View style={styles.modalOverlay}>
                            <View style={styles.dropdownModal}>
                              <View style={styles.dropdownHeader}>
                                <Text style={styles.dropdownTitle}>Select Year Level</Text>
                                <TouchableOpacity onPress={() => setShowYearLevelDropdown(false)}>
                                  <Icon name="close" size={24} color="#DC2626" />
                                </TouchableOpacity>
                              </View>
                              <FlatList
                                data={yearLevels}
                                keyExtractor={(item) => item}
                                renderItem={renderYearLevelItem}
                                showsVerticalScrollIndicator={false}
                              />
                            </View>
                          </View>
                        </Modal>
                      </View>
                    </View>
                  </View>
                )}

                {/* Password */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Icon name="shield-account" size={20} color="#DC2626" />
                    <Text style={styles.sectionTitle}>Security</Text>
                  </View>
                  
                  <View style={styles.grid}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Password *</Text>
                      <View style={styles.inputWrapper}>
                        <Icon name="lock" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="At least 6 characters"
                          placeholderTextColor="#9CA3AF"
                          value={formData.password}
                          onChangeText={(value) => handleInputChange('password', value)}
                          secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          style={styles.eyeButton}
                        >
                          <Icon 
                            name={showPassword ? "eye-off" : "eye"} 
                            size={20} 
                            color="#9CA3AF" 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Confirm Password *</Text>
                      <View style={styles.inputWrapper}>
                        <Icon name="lock-check" size={20} color="#9CA3AF" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Confirm your password"
                          placeholderTextColor="#9CA3AF"
                          value={formData.confirmPassword}
                          onChangeText={(value) => handleInputChange('confirmPassword', value)}
                          secureTextEntry={!showConfirmPassword}
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={styles.eyeButton}
                        >
                          <Icon 
                            name={showConfirmPassword ? "eye-off" : "eye"} 
                            size={20} 
                            color="#9CA3AF" 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Terms and Conditions */}
                <View style={styles.termsContainer}>
                  <TouchableOpacity 
                    style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}
                    onPress={() => setAgreedToTerms(!agreedToTerms)}
                  >
                    {agreedToTerms && <Icon name="check" size={14} color="#FFFFFF" />}
                  </TouchableOpacity>
                  <Text style={styles.termsText}>
                    I agree to the{' '}
                    <Text style={styles.termsLink}>Terms of Service</Text>
                    {' '}and{' '}
                    <Text style={styles.termsLink}>Privacy Policy</Text>
                  </Text>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.signupButton,
                    loading && styles.buttonDisabled
                  ]}
                  onPress={handleSignup}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Icon name="account-plus" size={20} color="#FFFFFF" />
                  )}
                  <Text style={styles.signupButtonText}>
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Text>
                </TouchableOpacity>

                {/* Login Link */}
                <View style={styles.linkContainer}>
                  <Text style={styles.linkText}>
                    Already have an account?{' '}
                  </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.link}>Sign in here</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
      
      {/* Date Picker Modal */}
      {renderDatePickerModal()}
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
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  signupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 24,
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
    marginBottom: 24,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
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
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  successIcon: {
    marginRight: 8,
  },
  successText: {
    color: '#166534',
    fontSize: 14,
    flex: 1,
  },
  // Toggle Styles
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleActive: {
    // Additional active styles if needed
  },
  toggleTrack: {
    width: 50,
    height: 28,
    backgroundColor: '#D1D5DB',
    borderRadius: 14,
    marginRight: 8,
    padding: 2,
    transition: 'all 0.3s ease',
  },
  toggleTrackActive: {
    backgroundColor: '#DC2626',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    transform: [{ translateX: 0 }],
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    minWidth: 30,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  grid: {
    gap: 16,
  },
  inputContainer: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    paddingLeft: 40,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#374151',
  },
  // Dropdown Styles
  dropdownButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  dropdownButtonText: {
    flex: 1,
    padding: 12,
    paddingLeft: 40,
    fontSize: 16,
    color: '#374151',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  dropdownArrow: {
    position: 'absolute',
    right: 12,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  // Age Display
  ageDisplay: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginLeft: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  dropdownModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  dropdownItemCode: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  // Date Picker Styles
  datePickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  dateInputContainer: {
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#374151',
  },
  dateHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  ageText: {
    fontSize: 14,
    color: '#DC2626',
    marginTop: 8,
    fontWeight: '600',
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  confirmButton: {
    backgroundColor: '#DC2626',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    padding: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  termsText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    lineHeight: 20,
  },
  termsLink: {
    color: '#DC2626',
    fontWeight: '600',
  },
  signupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    color: '#6B7280',
    fontSize: 14,
  },
  link: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SignupScreen;